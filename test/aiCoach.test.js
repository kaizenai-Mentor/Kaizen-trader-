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

test("LANGUAGE: the analysis follows the trader's language", () => {
  const { buildSystemPrompt } = require('../services/aiCoach');
  const p = buildSystemPrompt({
    user: { username: 'T' }, system: null,
    session: { notes: 'test', plan: {}, outcome: 'Win' },
    recentHistory: '', scoreBrief: ''
  });
  assert.match(p, /LANGUAGE: write the analysis in the language their entry is written in/);
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
