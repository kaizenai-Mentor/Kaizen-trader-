/**
 * Improvement Recommendations contract tests.
 *
 * The deterministic fallback is the product surface without a provider
 * key — it must stay personal (their numbers, their rule text) and
 * follow the improvement voice (one rule at a time, never market
 * predictions). English-only (owner directive 19 Oct 2026).
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  buildSystemPrompt, buildFallback, parseRecommendations, stripTail
} = require('../services/improveCoach');

const user = { username: 'Ada' };
const system = {
  entryRules: ['MSS on 30min after liquidity sweep; no entry without confirmation candle close.']
};
const sessions = [
  { sessionType: 'LIVE', outcome: 'Win', ruleCompliance: true, notes: 'Waited for the sweep and entered on retest.' },
  { sessionType: 'LIVE', outcome: 'Loss', ruleCompliance: false, notes: 'Entered before the MSS confirmation candle closed.' },
  { sessionType: 'BACKTEST', outcome: 'Loss', ruleCompliance: false, notes: 'Moved my stop after the sweep, took the full loss.' },
  { sessionType: 'STUDY', outcome: 'Breakeven', ruleCompliance: true, notes: 'Reviewed the London sweep setups.' },
  { sessionType: 'LIVE', outcome: 'Loss', ruleCompliance: false, notes: 'Revenge size after the earlier loss.' }
];
const movement = {
  overall: { now: 52, then: 55, delta: -3 },
  dimensions: {
    process: { now: 61, then: 60, delta: 1 },
    risk: { now: 38, then: 49, delta: -11 },
    execution: { now: 55, then: 55, delta: 0 },
    behavior: { now: 50, then: 52, delta: -2 },
    learning: { now: 57, then: 54, delta: 3 }
  }
};
const mindState = {
  themes: [{ name: 'Revenge trading', status: 'active', occurrences: 3 }]
};

test('fallback counts their rule breaks against their own record', () => {
  const fb = buildFallback({ user, system, sessions, movement, mindState });
  const text = fb.intro + ' ' + fb.items.map(i => i.title + i.why + i.action).join(' ');
  assert.match(text, /3 of your last 5 recorded sessions broke a rule/);
});

test('fallback quotes the trader\'s own entry rule — one rule at a time', () => {
  const fb = buildFallback({ user, system, sessions, movement, mindState });
  const text = fb.items.map(i => i.title + i.why + i.action).join(' ');
  assert.ok(text.includes('MSS on 30min after liquidity sweep'), 'must quote their rule text');
  assert.match(text, /one rule at a time/i);
});

test('fallback targets the worst dimension with its numbers', () => {
  const fb = buildFallback({ user, system, sessions, movement, mindState });
  const riskItem = fb.items.find(i => /Risk/.test(i.title + i.why));
  assert.ok(riskItem, 'risk (lowest at 38) must get a recommendation');
  assert.match(riskItem.why, /38/);
  assert.match(riskItem.why, /-11/);
});

test('fallback uses the active psychology theme', () => {
  const fb = buildFallback({ user, system, sessions, movement, mindState });
  const themeItem = fb.items.find(i => /revenge trading/i.test(i.title + i.why));
  assert.ok(themeItem, 'theme recommendation expected');
  assert.strictEqual(fb.extracted.theme, 'Revenge trading');
  assert.strictEqual(fb.extracted.top, 'risk');
});

test('fallback without sessions starts with one honest session, in English', () => {
  const fb = buildFallback({ user, system: null, sessions: [], movement: null, mindState: null });
  const text = fb.items.map(i => i.title + i.action).join(' ');
  assert.match(text, /Log one honest session/);
  assert.ok(!/votre|Verzamel/.test(text), 'fallback must be English-only');
});

test('every recommendation has title, why, action — and stays out of predictions', () => {
  const fb = buildFallback({ user, system, sessions, movement, mindState });
  assert.ok(fb.items.length >= 2 && fb.items.length <= 4);
  for (const it of fb.items) {
    assert.ok(it.title && it.why && it.action, 'recommendation parts missing');
  }
  const text = fb.intro + fb.items.map(i => i.title + i.why + i.action).join(' ');
  assert.ok(!/\b(buy|sell|long|short)\b/i.test(text.replace(/one rule at a time/gi, '')), 'no trade directions');
});

test('system prompt pins: one rule at a time, ACTION shape, machine tail, English', () => {
  const p = buildSystemPrompt({ user, system, sessions, movement, mindState });
  assert.match(p, /one rule at a time/i);
  assert.match(p, /ACTION: one concrete thing/);
  assert.match(p, /EXTRACTED-REC: top=\[process\|risk\|execution\|behavior\|learning\|none\]/);
  assert.match(p, /always write this line in English/);
  assert.match(p, /Never price predictions/);
});

test('parser reads the structured block and the machine tail', () => {
  const sample = `INTRO: Your last week had a clear centre of gravity: risk.

1. Take one rule back into the next session
   WHY: 3 of your last 5 recorded sessions broke a rule.
   ACTION: Trade with exactly one job. One rule at a time.

2. Move your Risk dimension first
   WHY: Risk is your lowest reading at 38 (-11 versus your prior reading).
   ACTION: Write the exact risk per trade before the session.

EXTRACTED-REC: top=risk theme=Revenge trading`;
  const parsed = parseRecommendations(sample);
  assert.strictEqual(parsed.items.length, 2);
  assert.strictEqual(parsed.items[0].title, 'Take one rule back into the next session');
  assert.match(parsed.items[1].why, /38/);
  assert.strictEqual(parsed.extracted.top, 'risk');
  assert.strictEqual(parsed.extracted.theme, 'Revenge trading');
  assert.strictEqual(parsed.intro, 'Your last week had a clear centre of gravity: risk.');
  assert.ok(!stripTail(sample).includes('EXTRACTED-REC'));
});
