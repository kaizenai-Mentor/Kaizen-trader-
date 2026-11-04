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

test('resolveSessionContext and buildSessionReview distinguish strategy (Daily Candlestick Liquidity) from pair (AUDJPY) without mid-sentence cutoff', () => {
  const { resolveSessionContext, buildSessionReview } = require('../services/aiCoach');
  const session = {
    asset: 'Daily Candlestick Liquidity', // legacy bug where setup was stored in asset
    sessionType: 'LIVE',
    plan: { setup: 'Daily Candlestick Liquidity', skipped: false },
    quickChecks: { followedPlan: 'NO', withinEntryCriteria: 'NO', respectedRisk: 'YES' },
    notes: 'My setup today was a sell setup on AUDJPY. After analyzing the pair, I entered before the daily candle liquidity sweep fully confirmed and closed at breakeven.'
  };
  const ctx = resolveSessionContext(session);
  assert.strictEqual(ctx.instrument, 'AUDJPY', 'must detect AUDJPY as the currency pair');
  assert.strictEqual(ctx.strategy, 'Daily Candlestick Liquidity', 'must recognize Daily Candlestick Liquidity as the strategy');
  assert.strictEqual(ctx.tradeDirection, 'sell');

  const review = buildSessionReview(session);
  assert.ok(!review.summary.includes('(Daily Candlestick Liquidity) on Daily Candlestick Liquidity'), 'must never repeat strategy as both plan and pair');
  assert.ok(review.summary.includes('using your Daily Candlestick Liquidity strategy') && review.summary.includes('on AUDJPY'), 'must name strategy and pair distinctly');
  assert.ok(!review.summary.endsWith('After analyzing the pair, I"'), 'must never cut off mid-sentence at 14 words');
});

test('Study and Backtest sessions on Japan 225 are recognized and coached as non-live chart study (never live execution or FOMO mental entry)', () => {
  const { resolveSessionContext, interpretJournal, buildSessionReview, parseSessionReview } = require('../services/aiCoach');
  const studySession = {
    asset: 'Daily Candlestick Liquidity ',
    sessionType: 'LIVE', // even if logged under LIVE, notes state studying
    plan: { setup: 'Daily Candlestick Liquidity ', skipped: false },
    reflection: { learned: 'I learnt to be patient for my full checklist to be complete before entering my set-up.' },
    notes: "I'm currently studying how to trade continuation DCL trends on Japan 225. The previous 4-hour candle swept liquidity and the 30-minute market structure shift confirmed the setup going according to my bias."
  };
  const ctx = resolveSessionContext(studySession);
  assert.strictEqual(ctx.instrument, 'Japan 225', 'must detect Japan 225 as the instrument');
  assert.strictEqual(ctx.strategy, 'Daily Candlestick Liquidity', 'must trim and recognize Daily Candlestick Liquidity as the strategy');
  assert.strictEqual(ctx.isStudyOrBacktest, true, 'must recognize session as study/backtest');

  const interp = interpretJournal(studySession);
  assert.strictEqual(interp.classification, 'STUDY_BACKTEST_SESSION');

  const review = buildSessionReview(studySession);
  assert.match(review.summary, /structured chart study and backtest using your Daily Candlestick Liquidity strategy on Japan 225/);
  assert.doesNotMatch(review.summary, /executed (inside|within) the boundaries/);
  assert.ok(review.noticed[0].startsWith('On Japan 225, you studied and tracked how your setup unfolded:'));

  // Also verify parseSessionReview auto-heals legacy stored text that had the old bug
  const legacyBrokenText = [
    'SESSION SUMMARY',
    'You declared your plan (Daily Candlestick Liquidity ) on Daily Candlestick Liquidity before the session and executed inside the boundaries you set — "I\'m currently studying how to trade continuation DCL trends on Japan 225. The previous".',
    'WHAT I NOTICED',
    '- On Daily Candlestick Liquidity , you documented: "I\'m currently studying how to trade continuation DCL trends on Japan 225. The previous…".',
    'WHAT CONCERNS ME',
    'The freeform journal entry describes the trade "going according to my bias," which could be interpreted as you having mentally taken the trade.'
  ].join('\n\n');
  const healed = parseSessionReview(legacyBrokenText, studySession);
  assert.match(healed.summary, /structured chart study and backtest using your Daily Candlestick Liquidity strategy on Japan 225/);
  assert.ok(healed.noticed[0].startsWith('On Japan 225, you studied and tracked how your setup unfolded:'));
  assert.doesNotMatch(healed.concerns, /mentally taken the trade/);
});

test('brokerVerify strips sensitive account data, matches delayed live sessions, and auto-generates Trader Dossier from Memories', () => {
  const { parseBrokerStatement, matchSessionWithBrokerHistory, buildAutoTraderDossier } = require('../services/brokerVerify');

  const mt5Sample = [
    'Account: 99887766, Name: Secret Trader, Balance: $50,000.00',
    '2026-10-28 08:00, balance, Initial Deposit, $50000.00',
    '10492817, 2026.10.29 09:15:00, sell, 1.50, AUDJPY, 101.420, 101.720, 100.820, 2026.10.29 11:40:00, 100.820, $600.00'
  ].join('\n');

  const trades = parseBrokerStatement(mt5Sample, 'ReportHistory.csv');
  assert.strictEqual(trades.length, 1, 'must parse trade row and ignore balance/account rows');
  assert.strictEqual(trades[0].instrument, 'AUDJPY');
  assert.strictEqual(trades[0].direction, 'Sell');
  assert.strictEqual(trades[0].outcome, 'Win');
  assert.strictEqual(trades[0].rrAchieved, '1:2.0');

  // Trader logs session 2 days after taking the trade
  const delayedLiveSession = {
    asset: 'AUDJPY',
    sessionType: 'LIVE',
    createdAt: new Date('2026-10-31T18:00:00Z'),
    plan: { setup: 'Daily Candlestick Liquidity', skipped: false },
    notes: 'Took a sell setup on AUDJPY after the daily liquidity sweep confirmed.',
    reflection: { learned: 'Patience paid off waiting for the 30m shift.' }
  };
  const matched = matchSessionWithBrokerHistory(delayedLiveSession, trades);
  assert.strictEqual(matched.verified, true);
  assert.strictEqual(matched.status, 'VERIFIED');

  // Unmatched live session gets the mentor verification note
  const unmatchedSession = {
    asset: 'GBPUSD',
    sessionType: 'LIVE',
    createdAt: new Date('2026-10-31T18:00:00Z'),
    notes: 'Took a buy setup on GBPUSD.'
  };
  const unmatched = matchSessionWithBrokerHistory(unmatchedSession, trades);
  assert.strictEqual(unmatched.verified, false);
  assert.strictEqual(unmatched.status, 'UNVERIFIED');
  assert.match(unmatched.verificationNote, /I skimmed your synced broker history for a matching GBPUSD buy execution and could not find this trade on record yet/);

  // Auto-generated Dossier from Memories & Sessions requires zero manual writing
  const dossier = buildAutoTraderDossier({
    user: { username: 'Dennis', disciplineScore: 84, brokerTrades: trades },
    system: { setups: [{ name: 'Daily Candlestick Liquidity' }], riskRules: { riskPerTrade: '1%' } },
    sessions: [delayedLiveSession]
  });
  assert.match(dossier.verificationId, /^KZN-\d{4}-[A-F0-9]{8}$/);
  assert.match(dossier.howITrade, /Daily Candlestick Liquidity/);
  assert.match(dossier.howITrade, /AUDJPY/);
  assert.strictEqual(dossier.memorableDecisions.length, 1);
});




