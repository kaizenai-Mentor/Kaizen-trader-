/**
 * Goal Guidance contract tests.
 *
 * Goals are behaviour targets set, tracked and adapted from the
 * trader's own record — personal, English-only, one rule at a time,
 * never profit targets or market predictions. Goals belong to the
 * trader: KAIZEN guides them and never proposes them (owner directive
 * 20 Oct 2026).
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  guide, parseGuide, currentValue,
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

test('goals are the trader\'s own — KAIZEN never proposes them', () => {
  const goalCoach = require('../services/goalCoach');
  assert.strictEqual(goalCoach.suggest, undefined, 'the propose-goals feature is removed on purpose');
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

test('guide: a goal without readings asks for one honest measurement — in its own words', () => {
  const goal = { title: 'Test goal', metric: 'CUSTOM', target: 5, unit: '', status: 'ACTIVE', progressLog: [] };
  const g = guide({ goal, user, system: null, sessions: [], movement: null, mindState: null });
  assert.match(g.assessment, /no readable number yet/);
  assert.ok(g.assessment.includes('"Test goal"'), 'guidance must quote the goal as they wrote it');
  assert.match(g.nextStep, /One rule at a time/);
});

test('guide: their written why is quoted back in the assessment', () => {
  const goal = {
    title: 'Journal every day this month',
    metric: 'JOURNAL_STREAK', target: 30, unit: 'days', cadence: 'MONTHLY', status: 'ACTIVE',
    progressLog: [], rationale: 'Be the trader who finishes the month with no hidden sessions.'
  };
  const g = guide({ goal, user, system: null, sessions: [], movement: null, mindState: null });
  assert.ok(g.assessment.includes('Be the trader who finishes the month with no hidden sessions.'),
    'their rationale must be quoted verbatim: ' + g.assessment);
  assert.ok(g.assessment.includes('"Journal every day this month"'), 'quote their title');
});

test('goal language stays out of money and predictions', () => {
  const goals = [
    { title: 'Keep 8 of your last 10 sessions inside your rules', metric: 'RULE_COMPLIANCE', target: 80, unit: '%', cadence: 'WEEKLY', status: 'ACTIVE', progressLog: [] },
    { title: 'Pass my Naira trader prop account', metric: 'CUSTOM', target: null, unit: '', cadence: 'WEEKLY', status: 'ACTIVE', progressLog: [], rationale: 'Get funded and stay funded.' },
    { title: 'Test goal', metric: 'CUSTOM', target: 5, unit: '', status: 'ACTIVE', progressLog: [] }
  ];
  for (const goal of goals) {
    const g = guide({ goal, user, system, sessions, movement: null, mindState });
    const text = goal.title + ' ' + (goal.rationale || '') + ' ' + g.assessment + ' ' + g.nextStep;
    assert.ok(!/\b(pips?|target price|p\/l|win rate|take profit)\b/i.test(text), 'no money language: ' + text);
    assert.ok(!/\b(buy|sell|long|short)\b(?!\s+of)/i.test(text), 'no trade directions: ' + text);
  }
});

test('parseGuide reads the ASSESSMENT/NEXT shape and strips asterisks', () => {
  const parsed = parseGuide('ASSESSMENT: **You are at 40%** on the goal.\nNEXT: Protect one rule ✳ in the next session.');
  assert.strictEqual(parsed.assessment, 'You are at 40% on the goal.');
  assert.strictEqual(parsed.nextStep, 'Protect one rule in the next session.');
});

// ── Prop-firm goals (owner directive 19 Oct 2026) ──────────────────
// A trader's goal can be to pass a prop firm evaluation and get
// funded. KAIZEN coaches the DISCIPLINE and ACCOUNTABILITY that
// evaluations measure — daily loss limit, drawdown, consistency, the
// trader's own rules. It never gives trading insights, signals, or
// market opinions. That boundary is the product.

const { isPropFirmGoal } = require('../services/goalCoach');

// Feedback-first batch (21 Oct 2026) — full module for the new surface.
const goalCoach = require('../services/goalCoach');

test('prop-firm goals are recognized by metric or by their words', () => {
  assert.ok(isPropFirmGoal({ metric: 'PROP_FIRM', title: 'Anything' }));
  assert.ok(isPropFirmGoal({ metric: 'CUSTOM', title: 'Pass my prop firm challenge' }));
  assert.ok(isPropFirmGoal({ metric: 'CUSTOM', title: 'Get funded this quarter' }));
  assert.ok(isPropFirmGoal({ metric: 'CUSTOM', title: 'Pass the evaluation', rationale: '' }));
  assert.ok(isPropFirmGoal({ metric: 'CUSTOM', title: 'Pass my Naira trader prop account' }),
    'traders phrase it their own way — "prop account" counts');
  assert.ok(isPropFirmGoal({ metric: 'CUSTOM', title: 'Stay funded', rationale: 'Keep the account I earned.' }));
  assert.ok(!isPropFirmGoal({ metric: 'CUSTOM', title: 'Journal every day' }));
});

test('prop-firm guidance is discipline + accountability, with their numbers', () => {
  const goal = {
    title: 'Pass my prop firm evaluation and get funded',
    metric: 'PROP_FIRM', target: 80, unit: '%', cadence: 'WEEKLY', status: 'ACTIVE',
    progressLog: []
  };
  const g = guide({ goal, user, system, sessions, movement: null, mindState });
  assert.match(g.assessment, /passed by discipline, not by ideas|earned by staying inside the limits/);
  assert.match(g.assessment, /daily loss limit/);
  assert.match(g.assessment, /never what to trade/);
  assert.match(g.assessment, /2 of your last 5/); // their own record stays in the loop
  assert.match(g.nextStep, /One rule at a time/);
});

test('prop-firm guidance answers the goal in the trader\'s own words', () => {
  const goal = {
    title: 'Pass my Naira trader prop account',
    metric: 'CUSTOM', target: null, unit: '', cadence: 'WEEKLY', status: 'ACTIVE',
    progressLog: [], rationale: 'Get funded and stay funded.'
  };
  const g = guide({ goal, user, system, sessions, movement: null, mindState });
  const text = g.assessment + ' ' + g.nextStep;
  assert.ok(text.includes('Pass my Naira trader prop account'), 'must quote their goal: ' + text);
  assert.ok(text.includes('Get funded and stay funded.'), 'must quote their why: ' + text);
  assert.match(text, /daily loss limit/);
  assert.match(text, /discipline|accountab/i);
});

test('prop-firm guidance never leaks trading insights or signals', () => {
  const goal = {
    title: 'Pass my prop firm evaluation and get funded',
    metric: 'PROP_FIRM', target: 80, unit: '%', cadence: 'WEEKLY', status: 'ACTIVE',
    progressLog: []
  };
  const g = guide({ goal, user, system, sessions, movement: null, mindState });
  const text = g.assessment + ' ' + g.nextStep;
  assert.ok(!/\b(buy|sell|long|short|entry point|take profit|stop hunt|breakout|market will|price (will|target))\b/i.test(text),
    'prop-firm guidance must stay out of trading insights: ' + text);
});

test('prop-firm guidance with no measurements asks for one honest check-in', () => {
  const goal = {
    title: 'Get funded with the challenge',
    metric: 'PROP_FIRM', target: 80, unit: '%', cadence: 'WEEKLY', status: 'ACTIVE',
    progressLog: []
  };
  const g = guide({ goal, user, system: null, sessions: [], movement: null, mindState: null });
  assert.match(g.assessment, /evaluation goal/);
  assert.match(g.nextStep, /risk question answered/);
  assert.match(g.nextStep, /One rule at a time|Accountability starts with one honest entry/);
});

test('the goal prompt states the boundary for the LLM path too', () => {
  const { buildGuidePrompt } = require('../services/goalCoach');
  const goal = { title: 'Pass my evaluation', metric: 'PROP_FIRM', target: 80, unit: '%', cadence: 'WEEKLY', status: 'ACTIVE' };
  const p = buildGuidePrompt({ goal, user, system, sessions, movement: null, mindState });
  assert.match(p, /no trading insights, no signals, no market opinions/);
  assert.match(p, /discipline and accountability the evaluation measures/);
});

test('daily feedback is quoted and gauged in the guidance', () => {
  const g = goalCoach.guide({
    goal: {
      title: 'Keep risk tight', metric: 'CUSTOM', target: 3, unit: '',
      cadence: 'WEEKLY', status: 'ACTIVE', rationale: 'Protect my capital.',
      progressLog: [
        { at: new Date('2026-10-20T10:00:00Z'), value: 1, note: 'Skipped a late-night entry.' },
        { at: new Date('2026-10-21T10:00:00Z'), value: 3, note: 'Waited for confirmation all day.' }
      ]
    },
    user: {}, sessions: [], movement: null, mindState: null,
    now: new Date('2026-10-21T12:00:00Z')
  });
  assert.ok(g.assessment.includes('Waited for confirmation all day.'),
    'latest feedback quoted in the assessment: ' + g.assessment);
  assert.match(g.assessment, /moved 1 → 3 across 2 entries/,
    'value movement gauged across entries');
});

test('feedback due rule: ACTIVE goal with no entry today', () => {
  assert.strictEqual(goalCoach.feedbackDueToday({ status: 'ACTIVE', progressLog: [] }), true);
  assert.strictEqual(
    goalCoach.feedbackDueToday({ status: 'ACTIVE', progressLog: [{ at: new Date(), note: 'ok' }] }), false);
  assert.strictEqual(
    goalCoach.feedbackDueToday({ status: 'PAUSED', progressLog: [] }), false);
  assert.strictEqual(
    goalCoach.feedbackDueToday({ status: 'ACTIVE', progressLog: [{ at: new Date('2026-10-01T09:00:00Z'), note: 'old' }] }), true);
});

test('guide prompt carries the DAILY FEEDBACK block', () => {
  const p = goalCoach.buildGuidePrompt({
    goal: {
      title: 'Journal every day', rationale: 'Build the habit.',
      metric: 'CUSTOM', target: 5, unit: '', cadence: 'WEEKLY', status: 'ACTIVE',
      progressLog: [{ at: new Date('2026-10-20T09:00:00Z'), value: 3, note: 'Blocked by hesitation.' }]
    },
    user: {}, sessions: [], movement: null, mindState: null
  });
  assert.match(p, /DAILY FEEDBACK/);
  assert.ok(p.includes('Blocked by hesitation.'), 'their words reach the LLM');
  assert.match(p, /gauge the process from their daily feedback/);
});

test('pre-session coach meeting: What you\'re doing well, Your biggest obstacle, Today\'s focus', () => {
  const tenSessions = [
    day(9, { outcome: 'Win', ruleCompliance: true, notes: 'Followed plan.' }),
    day(8, { outcome: 'Win', ruleCompliance: true, notes: 'Waited for sweep.' }),
    day(7, { outcome: 'Loss', ruleCompliance: false, notes: 'Revenge trade after frustrating loss.' }),
    day(6, { outcome: 'Win', ruleCompliance: true, notes: 'Inside rules.' }),
    day(5, { outcome: 'Breakeven', ruleCompliance: true, notes: 'Stood aside.' }),
    day(4, { outcome: 'Loss', ruleCompliance: false, notes: 'Entered early.' }),
    day(3, { outcome: 'Win', ruleCompliance: true, notes: 'Clean execution.' }),
    day(2, { outcome: 'Win', ruleCompliance: true, notes: 'Waited for confirmation.' }),
    day(1, { outcome: 'Loss', ruleCompliance: false, notes: 'Frustrated size.' }),
    day(0, { outcome: 'Win', ruleCompliance: true, notes: 'Followed rules.' })
  ];
  const g = goalCoach.guide({
    goal: {
      title: 'Pass my Naira Trader prop account',
      metric: 'PROP_FIRM', target: 80, unit: '%', cadence: 'WEEKLY', status: 'ACTIVE',
      rationale: 'Pass the evaluation honestly.',
      progressLog: []
    },
    user, system, sessions: tenSessions, movement: null, mindState
  });
  assert.strictEqual(g.yourGoal, 'Pass my Naira Trader prop account');
  assert.match(g.doingWell, /You followed your trading rules in 7 of your last 10 sessions\./);
  assert.match(g.doingWell, /Keep protecting that habit\./);
  assert.match(g.obstacle, /Your journal still shows revenge trading after frustrating outcomes\./);
  assert.match(g.obstacle, /That remains your biggest threat\./);
  assert.match(g.todaysFocus, /If frustration appears today,\nwalk away for 15 minutes before considering another trade\.\nProtect discipline\.\nNot profits\./);
});

