/**
 * tradeCoach tests — the KAIZEN AI conversation contract (spec §3.2)
 * made executable. Pure functions: no DB, no AI.
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  converse, buildFallback, digestSystem, digestSessions, SIGNAL_RE, MIND_RE
} = require('../services/tradeCoach');
const { CRISIS_RESPONSE } = require('../services/psychCoach');

const system = {
  name: 'London Open Playbook', version: 3,
  marketConditions: 'London session, trending pairs',
  setups: [{ name: 'London open breakout' }, { name: 'Pullback to 20 EMA' }],
  entryRules: 'Only after a sweep of Asia low + 15m MSS in the first 90 minutes.',
  exitRules: 'Fixed 2R target, move stop to BE at 1R.',
  riskRules: { riskPerTrade: '1%', maxDailyTrades: '3', dailyDrawdown: '3%', maxPositionSize: '0.5 lots' },
  tradingHours: '08:00–12:00 London',
  noTradeConditions: ['Red-folder news'],
  psychologicalRules: ['No entries in the first 10 minutes']
};

// ── Context digests ──────────────────────────────────────────────

test('digestSystem carries the actual rules to the prompt', () => {
  const d = digestSystem(system);
  assert.match(d, /London Open Playbook/);
  assert.match(d, /sweep of Asia low/);
  assert.match(d, /1% per trade/);
  assert.match(d, /v3/);
});

test('digestSessions reports plan/rule facts, never scores', () => {
  const d = digestSessions([
    { asset: 'XAUUSD', sessionType: 'LIVE', outcome: 'Loss', plan: { setup: 'London open breakout' }, quickChecks: { followedPlan: 'NO', respectedRisk: 'YES' } },
    { asset: 'EURUSD', sessionType: 'BACKTEST', outcome: 'Win', quickChecks: {} }
  ]);
  assert.match(d, /XAUUSD \(LIVE, Loss, setup: London open breakout, broke plan\)/);
  assert.match(d, /EURUSD \(BACKTEST, Win\)/);
  assert.ok(!/score/i.test(d));
});

// ── Hard lanes (no API key → deterministic paths) ────────────────

test('signal requests are declined and redirected to process', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const out = await converse({
    user: { username: 'Kai' }, system, sessions: [],
    threadMessages: [], userMessage: 'Should I buy bitcoin right now?'
  });
  assert.match(out.reply, /do not predict/i);
  assert.match(out.reply, /entry rules/i);
  assert.ok(!/buy|long|short/i.test(out.reply.replace(/should i buy/i, '')), 'no directional language');
});

test('signal regex catches common phrasings', () => {
  assert.ok(SIGNAL_RE.test('should I sell ETH here?'));
  assert.ok(SIGNAL_RE.test('what should I trade today'));
  assert.ok(SIGNAL_RE.test('is bitcoin a buy right now'));
  assert.ok(!SIGNAL_RE.test('should I review my rules?'));
});

test('mind-language regex flags psychology-lane drift', () => {
  assert.ok(MIND_RE.test('I feel anxious every time I open the charts'));
  assert.ok(!MIND_RE.test('I feel good about my entry rules'));
});

test('crisis language gets the care response here too', async () => {
  const out = await converse({
    user: { username: 'Kai' }, system, sessions: [],
    threadMessages: [], userMessage: 'I want to self-harm after this loss'
  });
  assert.equal(out.reply, CRISIS_RESPONSE);
});

// ── Deterministic fallback quality ───────────────────────────────

test('fallback anchors review to the written entry rule', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const out = await converse({
    user: { username: 'Kai' }, system, sessions: [],
    threadMessages: [], userMessage: 'Gold just swept the low, thinking of entering'
  });
  assert.match(out.reply, /sweep of Asia low/);
  assert.match(out.reply, /every clause/);
});

test('fallback with no system coaches the first rule, not an opinion', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const out = await converse({
    user: { username: 'Kai' }, system: null, sessions: [],
    threadMessages: [], userMessage: 'Gold just swept the low, thinking of entering'
  });
  assert.match(out.reply, /does not have written entry rules/i);
  assert.match(out.reply, /write one/i);
});

test('fallback quiz asks a real question from the risk rules', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const out = await converse({
    user: { username: 'Kai' }, system, sessions: [],
    threadMessages: [], userMessage: 'quiz me', mode: 'quiz'
  });
  assert.match(out.reply, /1%/);
  assert.match(out.reply, /daily stop|3%/);
});

test('image attach without vision gets an honest answer, not a fake one', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const out = await converse({
    user: { username: 'Kai' }, system, sessions: [],
    threadMessages: [], userMessage: '', imageDataUrl: 'data:image/png;base64,AAAA'
  });
  assert.match(out.reply, /cannot see the image/i);
  assert.match(out.reply, /will not pretend/i);
});


test('the prompt forbids discipline verdicts from prose alone (anti-gaming)', () => {
  const { buildSystemPrompt } = require('../services/tradeCoach');
  const p = buildSystemPrompt({ user: { username: 'T' }, system: null, sessions: [] });
  assert.match(p, /Never tell them they are disciplined because their message sounded committed/);
  assert.match(p, /the record is/);
});

// ── Coach rules (owner directive, 16 Oct 2026) ──────────────────

const tradeUser = { username: 'T' };

test('IMAGE RULE: silent context — the chart informs without being narrated', () => {
  const { buildSystemPrompt } = require('../services/tradeCoach');
  const p = buildSystemPrompt({ user: tradeUser, system, sessions: [] });
  assert.match(p, /THE IMAGE RULE/);
  assert.match(p, /SILENT CONTEXT/);
  assert.match(p, /without being narrated back unprompted/);
});

test('IMAGE RULE: correspondence-only and frozen vocabulary — no direction calls', () => {
  const { buildSystemPrompt } = require('../services/tradeCoach');
  const p = buildSystemPrompt({ user: tradeUser, system, sessions: [] });
  assert.match(p, /CORRESPONDENCE-ONLY/);
  assert.match(p, /vocabulary is FROZEN: structure, levels, zones, trend, their rule references/);
  assert.match(p, /Direction calls, predictions, and "setup" language never appear/);
});

test('CONSENT-BASED QUESTIONS: quiz mode dies the moment consent is withdrawn', () => {
  const { buildSystemPrompt, buildQuizPrompt } = require('../services/tradeCoach');
  const p = buildSystemPrompt({ user: tradeUser, system, sessions: [] });
  assert.match(p, /CONSENT-BASED QUESTIONS/);
  assert.match(p, /Quiz mode dies the moment they withdraw consent/);
  const q = buildQuizPrompt({ user: tradeUser, system, sessions: [] });
  assert.match(q, /THEY JUST ASKED TO BE QUIZZED/);
});

test('LANGUAGE: the trading room is English-only (owner directive 19 Oct 2026)', () => {
  const { buildSystemPrompt } = require('../services/tradeCoach');
  const p = buildSystemPrompt({ user: tradeUser, system, sessions: [] });
  assert.match(p, /Always reply in English/);
  assert.match(p, /Machine blocks stay in their fixed English format/);
});
