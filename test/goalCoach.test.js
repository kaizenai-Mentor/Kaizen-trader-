/**
 * Goal Guidance contract tests.
 *
 * Goals are behaviour targets set, tracked and adapted from the
 * trader's own record — personal, English-only, one rule at a time,
 * never profit targets or market predictions.
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  suggest, guide, parseGuide, currentValue,
  complianceRate, sessionsThisWeek, journalStreak
} = require('../services/goalCoach');

const user = { username: 'Ada' };
const system = {
  entryRules: ['MSS on 30min after liquidity sweep; no entry without confirmation candle close.']
};
const day = (offset, extra) => Object.assign({
  sessionType: 'LIVE',
  createdAt: new Date(Date.now() - offset * 864e5)
}, extra);
const sessions = [
  day(9, { outcome: 'Win', ruleCompliance: true, notes: 'Waited for the sweep.' }),
  day(8, { outcome: 'Loss', ruleCompliance: false, notes: 'Entered early.' }),
  day(6, { outcome: 'Loss', ruleCompliance: false, notes: 'Moved my stop.' }),
  day(10, { outcome: 'Breakeven', ruleCompliance: true, notes: 'Stood aside.' }),
  day(1, { outcome: 'Loss', ruleCompliance: false, notes: 'Revenge size.' })
];
const mindState = { themes: [{ name: 'Revenge trading', status: 'active' }] };

test('metrics compute from the record itself', () => {
  const comp = complianceRate(sessions);
  assert.strictEqual(comp.kept, 2);
  assert.strictEqual(comp.checked, 5);
  assert.strictEqual(comp.value, 40);
  assert.strictEqual(sessionsThisWeek(sessions), 2);
});

test('suggest: rule goal cites their own numbers and their rule text', () => {
  const goals = suggest({ user, system, sessions, movement: null, mindState });
  const ruleGoal = goals.find(g => g.metric === 'RULE_COMPLIANCE');
  assert.ok(ruleGoal, 'rule-compliance goal expected');
  assert.strictEqual(ruleGoal.target, 80);
  assert.match(ruleGoal.rationale, /2 of your last 5 recorded sessions/);
  assert.ok(ruleGoal.rationale.includes('MSS on 30min after liquidity sweep'), 'must quote their rule');
  assert.match(ruleGoal.rationale, /One rule at a time/);
});

test('suggest: low week volume proposes a sessions goal with the count', () => {
  const goals = suggest({ user, system, sessions, movement: null, mindState: null });
  const weekGoal = goals.find(g => g.metric === 'SESSIONS_PER_WEEK');
  assert.ok(weekGoal, 'sessions-per-week goal expected');
  assert.strictEqual(weekGoal.target, 3);
  assert.match(weekGoal.rationale, /You logged 2 sessions/);
});

test('suggest: the active psychology theme becomes a behaviour goal', () => {
  const goals = suggest({ user, system, sessions, movement: null, mindState });
  const themeGoal = goals.find(g => /revenge trading/i.test(g.title + g.rationale));
  assert.ok(themeGoal, 'theme goal expected');
  assert.strictEqual(themeGoal.metric, 'CUSTOM');
});

test('suggest: empty record starts with one full loop', () => {
  const goals = suggest({ user, system: null, sessions: [], movement: null, mindState: null });
  assert.strictEqual(goals.length, 1);
  assert.match(goals[0].title, /one full loop/i);
});

test('guide: the gap is stated with their numbers — one rule at a time', () => {
  const goal = {
    title: 'Keep 8 of your last 10 sessions inside your rules',
    metric: 'RULE_COMPLIANCE', target: 80, unit: '%', cadence: 'WEEKLY', status: 'ACTIVE',
    progressLog: []
  };
  const g = guide({ goal, user, system, sessions, movement: null, mindState });
  assert.match(g.assessment, /at 40%/);
  assert.match(g.assessment, /40% short of the 80%/);
  assert.match(g.assessment, /2 of your last 5 recorded sessions/);
  assert.match(g.nextStep, /One rule at a time/);
});

test('guide: meeting the goal says hold, then tighten by one step', () => {
  const goal = {
    title: 'Hold 9 of 10 inside your rules',
    metric: 'RULE_COMPLIANCE', target: 40, unit: '%', cadence: 'WEEKLY', status: 'ACTIVE',
    progressLog: []
  };
  const g = guide({ goal, user, system, sessions, movement: null, mindState });
  assert.match(g.assessment, /goal is being met/);
  assert.match(g.nextStep, /tighten the target by one step — never by two/);
});

test('guide: a goal without readings asks for one honest measurement', () => {
  const goal = { title: 'Test goal', metric: 'CUSTOM', target: 5, unit: '', status: 'ACTIVE', progressLog: [] };
  const g = guide({ goal, user, system: null, sessions: [], movement: null, mindState: null });
  assert.match(g.assessment, /no readable number yet/);
  assert.match(g.nextStep, /One rule at a time/);
});

test('goal language stays out of money and predictions', () => {
  const goals = suggest({ user, system, sessions, movement: null, mindState });
  const text = goals.map(g => g.title + g.rationale).join(' ');
  assert.ok(!/\b(profit|pips?|target price|p\/l|win rate)\b/i.test(text), 'no money language in goals');
  assert.ok(!/\b(buy|sell|long|short)\b/i.test(text), 'no trade directions');
});

test('parseGuide reads the ASSESSMENT/NEXT shape', () => {
  const parsed = parseGuide('ASSESSMENT: You are at 40% on the goal.\nNEXT: Protect one rule in the next session.');
  assert.strictEqual(parsed.assessment, 'You are at 40% on the goal.');
  assert.strictEqual(parsed.nextStep, 'Protect one rule in the next session.');
});
