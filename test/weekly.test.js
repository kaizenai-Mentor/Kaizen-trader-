/**
 * Weekly report tests (spec §4.2) — pure functions: no DB, no AI, no clock.
 */
const test = require('node:test');
const assert = require('node:assert');
const { weekStats, badgesThisWeek, EMPTY_WEEK_LETTER } = require('../services/weekly');
const { buildWeeklyFallback } = require('../services/aiCoach');

// ── weekStats ────────────────────────────────────────────────────

test('weekStats counts types, states, and compliance honestly', () => {
  const s = weekStats([
    { sessionType: 'LIVE', state: 'ANALYZED', ruleCompliance: true },
    { sessionType: 'LIVE', state: 'RECORDED', ruleCompliance: false },
    { sessionType: 'BACKTEST', state: 'ANALYZED', ruleCompliance: true },
    { sessionType: 'STUDY', state: 'PLANNED' }, // no ruleCompliance recorded
    { state: 'REFLECTED', ruleCompliance: true } // legacy doc → LIVE default
  ]);
  assert.equal(s.total, 5);
  assert.equal(s.byType.LIVE, 3);
  assert.equal(s.byType.BACKTEST, 1);
  assert.equal(s.byType.STUDY, 1);
  assert.equal(s.loopCompleted, 2);
  assert.equal(s.loopOpen, 3);
  assert.equal(s.checked, 4); // STUDY session had no compliance recorded
  assert.equal(s.compliant, 3);
  assert.equal(s.complianceRate, 75);
});

test('weekStats with nothing → zeros and null rate, never a guess', () => {
  const s = weekStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.complianceRate, null);
  assert.equal(s.loopOpen, 0);
});

// ── badgesThisWeek ───────────────────────────────────────────────

test('badgesThisWeek keeps only in-window milestones', () => {
  const weekStart = new Date('2026-09-07T00:00:00Z');
  const earned = badgesThisWeek([
    { name: 'Five Sessions', earnedAt: new Date('2026-09-10T12:00:00Z') },
    { name: 'Ten Sessions', earnedAt: new Date('2026-08-30T12:00:00Z') },
    { name: 'No Date' }
  ], weekStart);
  assert.equal(earned.length, 1);
  assert.equal(earned[0].name, 'Five Sessions');
});

// ── the honest empty state ───────────────────────────────────────

test('empty week letter says the fixed honest sentence', () => {
  assert.match(EMPTY_WEEK_LETTER, /No sessions this week\. The record notices — without judging\./);
  assert.match(EMPTY_WEEK_LETTER, /start with a plan/i);
});

// ── the deterministic weekly letter ──────────────────────────────

test('weekly fallback letter: honest, specific, zero score language', async () => {
  const letter = buildWeeklyFallback({
    weekSessions: [
      { sessionType: 'LIVE', state: 'ANALYZED', ruleCompliance: true },
      { sessionType: 'BACKTEST', state: 'RECORDED', ruleCompliance: false }
    ],
    movement: { dimensions: { risk: { delta: -4, now: 70 }, process: { delta: 2, now: 80 }, execution: { delta: null, now: null }, behavior: { delta: 0, now: 75 }, learning: { delta: 1, now: 82 } } },
    mindState: { themes: [{ name: 'Revenge after losses', status: 'active' }] }
  });
  assert.match(letter, /2 sessions/);
  assert.match(letter, /1 of 2 recorded sessions stayed inside your rules/);
  assert.match(letter, /revenge after losses/i); // MindState integration
  assert.match(letter, /risk, one rule at a time/); // the dropping dimension is the focus
  assert.ok(!/score|%\d|\d%/i.test(letter), 'no score language anywhere');
});

test('weekly fallback acknowledges a fully compliant week without rewarding volume', () => {
  const letter = buildWeeklyFallback({
    weekSessions: [
      { sessionType: 'LIVE', state: 'ANALYZED', ruleCompliance: true },
      { sessionType: 'LIVE', state: 'ANALYZED', ruleCompliance: true }
    ],
    movement: null,
    mindState: null
  });
  assert.match(letter, /Every recorded session stayed inside your rules/);
  assert.ok(!letter.includes('traded 30 times'));
});
