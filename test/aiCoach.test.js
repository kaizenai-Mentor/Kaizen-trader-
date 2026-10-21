/**
 * aiCoach tests — the session-analysis prompt contract.
 *
 * The anti-gaming rule (config/AiFunctions.js): conclusions about
 * discipline must rest on measured behavior, never on how well the
 * journal is written. Plus the EXTRACTED tail round-trip.
 */
const test = require('node:test');
const assert = require('node:assert');
const { buildSystemPrompt, parseExtracted, stripExtracted } = require('../services/aiCoach');

const SESSION = {
  sessionType: 'LIVE',
  plan: { setup: 'London sweep', skipped: false, emotionalState: 'CALM', confidence: 7 },
  quickChecks: { followedPlan: 'YES', withinEntryCriteria: 'YES', respectedRisk: 'YES' },
  outcome: 'Win',
  notes: 'Executed exactly as planned.',
  reflection: { whatHappened: 'Textbook.', followedProcess: 'Yes.', learned: 'Patience pays.', wouldChange: 'Nothing.' }
};

test('the prompt carries the grounding rule — prose is never evidence of discipline', () => {
  const p = buildSystemPrompt({
    user: { username: 'Kaizen' }, system: {}, session: SESSION,
    recentHistory: '', scoreBrief: 'Score computed separately by the engine.'
  });
  assert.match(p, /never evidence of discipline/);
  assert.match(p, /quick checks, rule compliance, and the engine summary/);
  // and the core contract is still stated
  assert.match(p, /never quote numbers as a score/);
});

test('EXTRACTED tail round-trip: parse then strip', () => {
  const raw = 'WHAT YOU EXECUTED WELL\nDone.\n\nEXTRACTED: outcome=Win rr=1:2.5 pips=+45';
  const ex = parseExtracted(raw);
  assert.deepStrictEqual(ex, { outcome: 'Win', rr: '1:2.5', pips: '+45' });
  assert.strictEqual(stripExtracted(raw), 'WHAT YOU EXECUTED WELL\nDone.');
  assert.strictEqual(parseExtracted('no tail here'), null);
});

// ── Coach rules (owner directive, 16 Oct 2026) ──────────────────

test('LANGUAGE: the analysis is English-only (owner directive 19 Oct 2026)', () => {
  const { buildSystemPrompt, buildFallback } = require('../services/aiCoach');
  const p = buildSystemPrompt({
    user: { username: 'T' }, system: null,
    session: { notes: 'test', plan: {}, outcome: 'Win' },
    recentHistory: '', scoreBrief: ''
  });
  assert.match(p, /LANGUAGE: always write the analysis in English/);
  // Deterministic fallbacks are English regardless of any lang argument.
  const fb = buildFallback({ notes: 'Moved my stop after the sweep.', asset: 'XAUUSD', plan: {}, outcome: 'Loss' }, 'fr');
  assert.match(fb, /your/);
  assert.ok(!/votre|Vous avez/.test(fb), 'fallback must not speak French');
});

test('EXTRACTED stays parseable: fixed English format in every language', () => {
  const { buildSystemPrompt, parseExtracted, stripExtracted } = require('../services/aiCoach');
  const p = buildSystemPrompt({
    user: { username: 'T' }, system: null,
    session: { notes: 'test', plan: {}, outcome: 'Win' },
    recentHistory: '', scoreBrief: ''
  });
  assert.match(p, /always write this line in English and in exactly this format/);
  assert.match(p, /EXTRACTED: outcome=\[Win\/Loss\/Breakeven\/No Trade\]/);
  // The parser is language-proof: the line parses the same wherever it appears
  const fr = 'Bonne exécution ce jour-là.\nEXTRACTED: outcome=Win rr=1:2 pips=+30';
  assert.deepStrictEqual(parseExtracted(fr), { outcome: 'Win', rr: '1:2', pips: '+30' });
  assert.ok(!stripExtracted(fr).includes('EXTRACTED'));
});

test('the record is the teacher: no conclusion without measured behavior', () => {
  const { buildSystemPrompt } = require('../services/aiCoach');
  const p = buildSystemPrompt({
    user: { username: 'T' }, system: null,
    session: { notes: 'test', plan: {}, outcome: 'Win' },
    recentHistory: '', scoreBrief: ''
  });
  assert.match(p, /GROUNDING \(frozen\)/);
  assert.match(p, /never evidence of discipline/);
});

// ── Deep interpretation & 6-Step Coaching Framework (21 Oct 2026) ──

test('core principle & 6-step coaching framework live in the prompt', () => {
  const { buildSystemPrompt } = require('../services/aiCoach');
  const p = buildSystemPrompt({
    user: { username: 'T' }, system: null,
    session: { notes: 'test', plan: {}, outcome: 'Win' },
    recentHistory: '', scoreBrief: ''
  });
  assert.match(p, /The trader documents the session\. KAIZEN interprets it\./);
  assert.match(p, /Understand why the trader made each decision before judging it/);
  for (const dim of ['chronology', 'causality', 'intention', 'justification', 'discipline', 'emotional context', 'contradictions', 'consistency with previous sessions']) {
    assert.ok(p.includes(dim), 'missing journal reading dimension: ' + dim);
  }
  for (let i = 1; i <= 6; i++) {
    assert.match(p, new RegExp(`Step ${i} —`), 'missing Step ' + i);
  }
});

test('interpretJournal distinguishes a disciplined plan revision from an emotional deviation', () => {
  const { interpretJournal, buildSessionReview, parseSessionReview, buildFallback } = require('../services/aiCoach');

  // 1. Documented market-structure plan revision (the owner's exact scenario)
  const revisedSession = {
    asset: 'EURUSD',
    sessionType: 'LIVE',
    plan: { setup: 'Buy break of high', entryCondition: 'Break of previous high', skipped: false },
    quickChecks: { followedPlan: 'NO', withinEntryCriteria: 'YES', respectedRisk: 'YES' },
    notes: 'After studying the weekend structure I observed price failed to break the previous high. I cross checked my bias and switched to a sell.'
  };
  const revInterp = interpretJournal(revisedSession);
  assert.strictEqual(revInterp.isPlanRevision, true, 'must recognize documented thesis revision');
  assert.strictEqual(revInterp.isEmotionalDeviation, false);
  assert.strictEqual(revInterp.classification, 'DISCIPLINED_PLAN_REVISION');

  const review = buildSessionReview(revisedSession);
  assert.match(review.summary, /Your original plan evolved after additional market analysis/);
  assert.match(review.summary, /disciplined adjustment rather than an emotional deviation/);
  assert.match(review.summary, /continue documenting what invalidated the original thesis/);

  const parsed = parseSessionReview(buildFallback(revisedSession), revisedSession);
  assert.match(parsed.summary, /disciplined adjustment rather than an emotional deviation/);
  assert.ok(Array.isArray(parsed.noticed) && parsed.noticed.length >= 3, '3-4 observations in What I noticed');
  assert.ok(parsed.concerns.length > 10, 'What concerns me populated');
  assert.ok(parsed.didWell.length > 10, 'What you did well populated');
  assert.ok(parsed.nextImprovement.length > 10, 'Your next improvement populated');

  // 2. Emotional / impulsive direction change is NOT treated as a disciplined revision
  const emotionalSession = {
    asset: 'EURUSD',
    sessionType: 'LIVE',
    plan: { setup: 'Buy break of high', skipped: false },
    quickChecks: { followedPlan: 'NO', withinEntryCriteria: 'NO', respectedRisk: 'NO' },
    notes: 'Planned a buy, got frustrated after a red candle and impulsively switched to a revenge sell and moved my stop.'
  };
  const emoInterp = interpretJournal(emotionalSession);
  assert.strictEqual(emoInterp.isPlanRevision, false, 'emotional impulse is never a plan revision');
  assert.strictEqual(emoInterp.isEmotionalDeviation, true);
  assert.strictEqual(emoInterp.classification, 'EMOTIONAL_DEVIATION');
});

