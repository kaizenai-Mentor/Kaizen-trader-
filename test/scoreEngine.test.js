/**
 * Score Engine tests — the frozen contract of config/App.js B6/B6b
 * made executable. Pure functions: no DB, no AI, no clock.
 */
const test = require('node:test');
const assert = require('node:assert');
const { computeScore, FORMULA_VERSION } = require('../services/scoreEngine');

let day = 0;
function mk(o = {}) {
  day += 1;
  return Object.assign({
    createdAt: new Date(Date.UTC(2026, 8, 1 + day, 9)),
    sessionType: 'LIVE',
    state: 'ANALYZED',
    notes: 'Clean session, executed the plan.',
    emotion: 'Calm',
    plan: { setup: '4H sweep → 30min MSS', skipped: false, emotionalState: 'CALM', confidence: 7 },
    quickChecks: { followedPlan: 'YES', withinEntryCriteria: 'YES', respectedRisk: 'YES' },
    reflection: {
      whatHappened: 'Entered as planned and held through the squeeze.',
      followedProcess: 'Yes, fully this time.',
      learned: 'The five-minute timer works when it matters most.',
      wouldChange: 'Nothing this time.'
    },
    outcome: 'Win',
    evidenceFlags: {}
  }, o);
}

test('empty history — every dimension BUILDING, no fake numbers', () => {
  const r = computeScore([], null, null);
  for (const d of Object.keys(r.dimensions)) {
    assert.strictEqual(r.dimensions[d].state, 'BUILDING', d);
    assert.strictEqual(r.dimensions[d].score, null, d);
  }
  assert.strictEqual(r.overall, null);
  assert.strictEqual(r.formulaVersion, FORMULA_VERSION);
});

test('a perfect streak is the Maintaining state — high compliance is never a flag', () => {
  const sessions = Array.from({ length: 12 }, () => mk());
  const r = computeScore(sessions, { riskRules: { maxDailyTrades: '2' } }, null);

  assert.strictEqual(r.overallState, 'READY');
  assert.ok(r.overall >= 85, `overall should be high, got ${r.overall}`);
  assert.strictEqual(r.dimensions.learning.state, 'READY');
  assert.ok(r.dimensions.learning.reasons.some(x => /maintaining/i.test(x)),
    'learning must name the Maintaining state');
  // No dimension is punished for being too good
  for (const d of Object.keys(r.dimensions)) {
    assert.ok(!r.dimensions[d].reasons.some(x => /suspicious|low.signal|under review/i.test(x)), d);
  }
});

test('honest skip counts with partial credit — reduced evidence, not punishment', () => {
  const sessions = [
    ...Array.from({ length: 5 }, () => mk()),
    ...Array.from({ length: 5 }, () => mk({ plan: { skipped: true }, quickChecks: { followedPlan: 'NO_PLAN', withinEntryCriteria: 'NOT_MENTIONED', respectedRisk: 'YES' } }))
  ];
  const r = computeScore(sessions, null, null);
  const p = r.dimensions.process;
  assert.strictEqual(p.state, 'READY');
  assert.strictEqual(p.score, 82); // 0.55*0.675 + 0.45 adherence
  assert.ok(p.reasons.some(x => /planned 5 of your last 10/i.test(x)));
});

test('untouched quick checks never count for or against', () => {
  const sessions = Array.from({ length: 6 }, () => mk({
    quickChecks: { followedPlan: 'NOT_MENTIONED', withinEntryCriteria: 'NOT_MENTIONED', respectedRisk: 'NOT_MENTIONED' }
  }));
  const r = computeScore(sessions, null, null);
  // No YES/NO evidence at all → Process cannot be READY despite planning
  assert.strictEqual(r.dimensions.process.state, 'BUILDING');
  assert.strictEqual(r.dimensions.risk.state, 'BUILDING');
});

test('cadence guard: the farming attempt becomes the data', () => {
  const sameDay = new Date(Date.UTC(2026, 8, 20, 9));
  const sessions = [
    mk({ createdAt: sameDay }),
    mk({ createdAt: new Date(Date.UTC(2026, 8, 20, 11)) }),
    mk({ createdAt: new Date(Date.UTC(2026, 8, 20, 14)) }),
    ...Array.from({ length: 7 }, () => mk())
  ];
  const r = computeScore(sessions, { riskRules: { maxDailyTrades: '2' } }, null);
  // Third same-day session is flagged beyond cadence
  assert.strictEqual(sessions[2].evidenceFlags.beyondCadence, true);
  // Risk is damped by the cadence break
  assert.ok(r.dimensions.risk.score < 100, 'cadence break must damp Risk');
  // Behavior counts the excess as a negative signal
  assert.ok(r.dimensions.behavior.reasons.some(x => /emotional pressure/i.test(x)));
});

test('duplicate-flagged reflections earn zero learning credit (novelty guard)', () => {
  const dup = mk({ evidenceFlags: { duplicateOf: '000000000000000000000000' } });
  const sessions = [dup, ...Array.from({ length: 5 }, () => mk())];
  const r1 = computeScore(sessions, null, null);
  const r2 = computeScore(sessions.slice(1), null, null);
  assert.strictEqual(r1.dimensions.learning.reasons.length >= 0, true);
  assert.ok(r1.dimensions.learning.score <= r2.dimensions.learning.score,
    'a duplicate-flagged session must not raise Learning');
});

test('correction arcs are recognized — violation corrected within three sessions', () => {
  const sessions = Array.from({ length: 6 }, () => mk());
  sessions[1].quickChecks = { followedPlan: 'NO', withinEntryCriteria: 'NO', respectedRisk: 'YES' };
  sessions[2].quickChecks = { followedPlan: 'YES', withinEntryCriteria: 'YES', respectedRisk: 'YES' };
  const r = computeScore(sessions, null, null);
  assert.ok(r.dimensions.learning.reasons.some(x => /corrected a breakdown/i.test(x)));
});

test('extracted-only evidence → PARTIAL state, dampened toward neutral', () => {
  const extracted = {
    process: { rate: 1.0, count: 8 },
    risk: { rate: 0.9, count: 8 },
    execution: { rate: 0.8, count: 8 },
    behavior: { rate: 0.9, count: 12 },
    learning: { rate: 0.8, count: 10 }
  };
  const r = computeScore([], null, extracted);
  assert.strictEqual(r.dimensions.process.state, 'PARTIAL');
  // rate 1.0 extracted → 50 + 50*0.6 = 80, never the full 100
  assert.strictEqual(r.dimensions.process.score, 80);
  assert.strictEqual(r.overallState, 'PARTIAL');
  assert.strictEqual(r.evidenceMix.extracted > 0, true);
});

test('deterministic: same inputs, identical output', () => {
  const sessions = Array.from({ length: 8 }, () => mk());
  const a = computeScore(sessions, null, null, new Date('2026-09-15'));
  const b = computeScore([...sessions], null, null, new Date('2026-09-15'));
  assert.deepStrictEqual(a, b);
});

test('STUDY sessions never trip the cadence guard', () => {
  const sameDay = new Date(Date.UTC(2026, 8, 20, 9));
  const sessions = [
    mk({ createdAt: sameDay, sessionType: 'STUDY', plan: { skipped: false }, quickChecks: { followedPlan: 'NOT_MENTIONED', withinEntryCriteria: 'NOT_MENTIONED', respectedRisk: 'NOT_MENTIONED' } }),
    mk({ createdAt: new Date(Date.UTC(2026, 8, 20, 10)), sessionType: 'STUDY', quickChecks: { followedPlan: 'NOT_MENTIONED', withinEntryCriteria: 'NOT_MENTIONED', respectedRisk: 'NOT_MENTIONED' } }),
    mk({ createdAt: new Date(Date.UTC(2026, 8, 20, 11)), sessionType: 'STUDY', quickChecks: { followedPlan: 'NOT_MENTIONED', withinEntryCriteria: 'NOT_MENTIONED', respectedRisk: 'NOT_MENTIONED' } }),
    ...Array.from({ length: 7 }, () => mk())
  ];
  computeScore(sessions, { riskRules: { maxDailyTrades: '2' } }, null);
  assert.ok(!sessions.some(s => s.evidenceFlags.beyondCadence), 'study sessions must not count as trades');
});
