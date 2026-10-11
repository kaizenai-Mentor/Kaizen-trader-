/**
 * psychCoach tests — the psychology conversation contract (spec §3.1,
 * owner decisions D2/D3) made executable. Pure functions: no DB, no AI.
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  parsePsychState, stripPsychState, applyPsychState,
  buildFallback, converse, CRISIS_RESPONSE
} = require('../services/psychCoach');

// ── PSYCH-STATE tail parsing ─────────────────────────────────────

test('parses a full PSYCH-STATE tail', () => {
  const raw = [
    'Thank you for sharing that. One question first.',
    '',
    'PSYCH-STATE:',
    'SUMMARY: Guarded but committed; trades from a place of fear on Mondays.',
    'THEME: Fear / anxiety around trading | improving | Named it unprompted today.',
    'TRIGGER: Monday opens after a losing weekend | mentioned twice now.',
    'HELP: Writing the one rule before opening charts | said it calms the itch.'
  ].join('\n');
  const p = parsePsychState(raw);
  assert.equal(p.summary, 'Guarded but committed; trades from a place of fear on Mondays.');
  assert.equal(p.themes.length, 1);
  assert.equal(p.themes[0].name, 'Fear / anxiety around trading');
  assert.equal(p.themes[0].status, 'improving');
  assert.equal(p.triggers[0].situation, 'Monday opens after a losing weekend');
  assert.equal(p.helps[0].what, 'Writing the one rule before opening charts');
});

test('no tail → empty state, text untouched', () => {
  const raw = 'A plain reply with no tail whatsoever.';
  const p = parsePsychState(raw);
  assert.equal(p.summary, '');
  assert.equal(p.themes.length, 0);
  assert.equal(stripPsychState(raw), raw);
});

test('stripPsychState removes the tail from display text', () => {
  const raw = 'The visible reply.\n\nPSYCH-STATE:\nSUMMARY: hidden from user.';
  assert.equal(stripPsychState(raw), 'The visible reply.');
});

test('unknown theme status coerces to active', () => {
  const p = parsePsychState('PSYCH-STATE:\nSUMMARY: s\nTHEME: X | banana | note');
  assert.equal(p.themes[0].status, 'active');
});

// ── MindState self-update (D2: permanent, never deletes) ─────────

const now = new Date('2026-09-13T10:00:00Z');

test('new theme is added with firstSeen/occurrences', () => {
  const ms = { summary: '', themes: [], triggers: [], helps: [], summaryHistory: [] };
  applyPsychState(ms, { summary: 'First picture.', themes: [{ name: 'Revenge after losses', status: 'active', note: '' }], triggers: [], helps: [] }, now);
  assert.equal(ms.themes.length, 1);
  assert.equal(ms.themes[0].occurrences, 1);
  assert.equal(ms.themes[0].firstSeen.getTime(), now.getTime());
  assert.equal(ms.summary, 'First picture.');
  assert.equal(ms.summaryHistory.length, 1);
});

test('repeated theme increments occurrences and updates status — never deleted', () => {
  const ms = { summary: '', themes: [], triggers: [], helps: [], summaryHistory: [] };
  const tail = { summary: '', themes: [{ name: 'FOMO / chasing moves', status: 'active', note: '' }], triggers: [], helps: [] };
  applyPsychState(ms, tail, now);
  applyPsychState(ms, { summary: '', themes: [{ name: 'fomo / chasing moves', status: 'improving', note: 'Caught it today.' }], triggers: [], helps: [] }, now);
  assert.equal(ms.themes.length, 1); // case-insensitive match, no duplicate
  assert.equal(ms.themes[0].occurrences, 2);
  assert.equal(ms.themes[0].status, 'improving');
  assert.equal(ms.themes[0].note, 'Caught it today.');
});

test('resolved themes stay on record (memory is the reference)', () => {
  const ms = { summary: '', themes: [{ name: 'Overconfidence after wins', status: 'active', note: '', firstSeen: now, lastSeen: now, occurrences: 4 }], triggers: [], helps: [], summaryHistory: [] };
  applyPsychState(ms, { summary: '', themes: [{ name: 'Overconfidence after wins', status: 'resolved', note: 'Two steady months.' }], triggers: [], helps: [] }, now);
  assert.equal(ms.themes.length, 1);
  assert.equal(ms.themes[0].status, 'resolved');
  assert.equal(ms.themes[0].occurrences, 5);
});

test('summaryHistory is capped at 50 entries', () => {
  const ms = { summary: '', themes: [], triggers: [], helps: [], summaryHistory: [] };
  for (let i = 0; i < 60; i++) {
    applyPsychState(ms, { summary: 's' + i, themes: [], triggers: [], helps: [] }, now);
  }
  assert.equal(ms.summaryHistory.length, 50);
  assert.equal(ms.summaryHistory[0].summary, 's10');
});

// ── Crisis lane (coach, not therapist) ───────────────────────────

test('crisis language gets the care response, no AI, and is recorded', async () => {
  const out = await converse({
    user: { username: 'Kai' }, system: null, sessions: [], mindState: null,
    threadMessages: [], userMessage: 'I keep thinking about ending my life'
  });
  assert.equal(out.reply, CRISIS_RESPONSE);
  assert.match(out.reply, /crisis line/i);
  assert.equal(out.psychState.themes[0].name, 'Crisis — professional support recommended');
});

// ── Deterministic fallback (no API key) ──────────────────────────

test('fallback replies honestly without an API key, references prior theme', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const mindState = { summary: '', themes: [{ name: 'Revenge after losses', status: 'active', note: '', firstSeen: now, lastSeen: now, occurrences: 1 }], triggers: [], helps: [], summaryHistory: [] };
  const out = await converse({
    user: { username: 'Kai' }, system: null, sessions: [], mindState,
    threadMessages: [], userMessage: 'I blew up again today, frustrated beyond words'
  });
  assert.ok(out.reply.length > 100);
  assert.match(out.reply, /revenge after losses/i);
  assert.ok(!/DISCIPLINE SCORE|score of \d+/i.test(out.reply), 'no score language in psych replies');
  assert.equal(out.psychState.themes[0].name, 'Revenge after losses'); // deterministic updater
});

test('fallback flags violations pattern from sessions without judging', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const sessions = [1, 2, 3].map(() => ({ ruleCompliance: false, outcome: 'Loss' }));
  const out = await converse({
    user: { username: 'Kai' }, system: null, sessions,
    threadMessages: [], userMessage: 'I do not know what is happening to me lately'
  });
  assert.match(out.reply, /3 of your last five sessions/);
  assert.match(out.reply, /the rules are rarely the problem/);
});
