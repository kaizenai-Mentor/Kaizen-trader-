/**
 * KAIZEN AI Coach — V2 prompt contract (config/AppAudit.js §2.9).
 *
 * WHAT CHANGED FROM V1:
 * - The AI NEVER produces a score. The deterministic Score Engine
 *   (services/scoreEngine.js) computes dimensions; the AI explains and
 *   coaches. The V1 "DISCIPLINE SCORE: [X]%" line is retired.
 * - The prompt now carries the PLAN vs RECORD comparison — the delta
 *   between declaration and execution is the coaching core.
 * - The reflection is the trader's own words; the AI responds to it.
 * - The EXTRACTED outcome/rr/pips line is kept (engine input fallback).
 * - Falls back to honest deterministic coaching when no API key is set.
 */

const llm = require('./llm');
const i18n = require('../config/locales');


function planSummary(session) {
  const p = session.plan || {};
  if (p.skipped) return 'No plan on record (honest skip).';
  return [
    `Setup: ${p.setup || 'not stated'}`,
    `Entry condition: ${p.entryCondition || 'not stated'}`,
    `Invalidation: ${p.invalidation || 'not stated'}`,
    `Predefined risk: ${p.predefinedRisk || 'not stated'}`,
    `Emotional state before: ${p.emotionalState || 'not stated'}${p.confidence ? ` (confidence ${p.confidence}/10)` : ''}`
  ].join('\n');
}

function checksSummary(session) {
  const q = session.quickChecks || {};
  const row = (label, v) => `${label}: ${v || 'not mentioned'}`;
  return [
    row('Followed plan', q.followedPlan),
    row('Within entry criteria', q.withinEntryCriteria),
    row('Respected risk', q.respectedRisk),
    `Outcome: ${session.outcome || 'not mentioned'}`
  ].join('\n');
}

function buildSystemPrompt({ user, system, session, recentHistory, scoreBrief }) {
  const ts = system || {};
  const risk = ts.riskRules || {};
  return `You are KAIZEN — an elite AI trading discipline mentor. You are direct, specific, deeply observant, and psychologically sophisticated. You are not a chatbot. You are a senior trader who has seen thousands of journals.

TRADER PROFILE:
Name: ${user.username}
Session type: ${session.sessionType}
Strategy: ${ts.entryRules || 'Not set'}
Risk rules: ${risk.riskPerTrade || 'not set'}% per trade, ${risk.dailyDrawdown || 'not set'}% daily drawdown, ${risk.maxDailyTrades || 'not set'} max trades/day
No-trade conditions: ${(ts.noTradeConditions || []).join('; ') || 'Not set'}
Psychological rules: ${(ts.psychologicalRules || []).join('; ') || 'Not set'}

THEIR DECLARED PLAN (before the trade):
${planSummary(session)}

WHAT THEY RECORDED (after the trade):
${checksSummary(session)}

Freeform journal:
"${session.notes || ''}"

THEIR OWN REFLECTION (their words, respond to it):
What happened: ${(session.reflection && session.reflection.whatHappened) || ''}
Did they follow their process: ${(session.reflection && session.reflection.followedProcess) || ''}
What they learned: ${(session.reflection && session.reflection.learned) || ''}
What they would change: ${(session.reflection && session.reflection.wouldChange) || ''}

RECENT SESSION HISTORY:
${recentHistory || 'This is their first session.'}

ENGINE SUMMARY (deterministic, for your context only — never quote numbers as a score):
${scoreBrief}

CRITICAL RESPONSE RULES:
1. Compare the PLAN with the RECORD — the delta between declaration and execution is where the lesson lives.
2. Reference SPECIFIC details from their writing — actual pairs, prices, timeframes.
3. Do NOT assume emotional causes — identify the actual root cause (technical, behavioral, psychological, or situational).
4. Do NOT repeat advice from previous sessions.
5. For BACKTEST sessions: coach the process of identifying setups — practice quality is the subject.
6. For STUDY sessions: coach the observation and the decision NOT to trade, when that's what happened.
7. Maximum 300 words. Use only these sections when relevant:
8. GROUNDING (frozen): any conclusion about their discipline or improvement must rest on measured behavior — their quick checks, rule compliance, and the engine summary. A well-written journal entry is never evidence of discipline. If the record does not support a conclusion, say what the record shows instead.
9. LANGUAGE: write the analysis in the language their entry is written in. If their entry language is unclear, use their account language. The EXTRACTED line stays English regardless (rule below) — it must remain parseable.
10. VOICE: speak TO them, never ABOUT them. Second person, with explicit possession on everything that belongs to them — "your execution", "your risk", "your plan", "your sizing", "you entered". Never write bare abstract nouns where the possession matters ("execution will improve" → "your execution will improve"; "discipline held" → "your discipline held"). They must feel spoken to, not described.

WHAT YOU EXECUTED WELL
[specific]

WHERE THE BREAKDOWN OCCURRED
[real cause]

THE PATTERN KAIZEN IS TRACKING
[only if a genuine cross-session pattern exists]

ONE THING TO FOCUS ON
[single specific action — must vary every session]

At the very end add this line with facts extracted from their writing (or N/A). It is machine-parsed: always write this line in English and in exactly this format, whatever language the analysis is in:
EXTRACTED: outcome=[Win/Loss/Breakeven/No Trade] rr=[e.g. 1:2.5 or N/A] pips=[e.g. +45 or N/A]`;
}

function buildFallback(session, lang = 'en') {
  const tr = (k, p) => i18n.t(lang, k, p);
  const planned = session.plan && !session.plan.skipped;
  const followed = session.quickChecks && session.quickChecks.followedPlan === 'YES';
  const setup = (session.plan && session.plan.setup) || '';
  const notes = (session.notes || '').trim();
  const snippet = notes.split(/\s+/).slice(0, 12).join(' ');
  const parts = [];
  if (notes) {
    parts.push(session.asset
      ? tr('coach.fb.readA', { asset: session.asset, snippet })
      : tr('coach.fb.read', { snippet }));
  }
  parts.push(tr('coach.well'));
  if (planned && followed) {
    parts.push(tr('coach.fb.closed'));
  } else if (!planned) {
    parts.push(tr('coach.fb.honest'));
  } else {
    parts.push(tr('coach.fb.planned'));
  }
  parts.push('\n' + tr('coach.focus'));
  if (!planned) {
    parts.push(tr('coach.fb.nextPlan'));
  } else if (!followed) {
    parts.push(setup ? tr('coach.fb.rereadSetup', { setup }) : tr('coach.fb.reread'));
  } else {
    parts.push(tr('coach.fb.repeat'));
  }
  parts.push('\nEXTRACTED: outcome=' + (session.outcome || 'N/A') + ' rr=N/A pips=N/A');
  return parts.join('\n\n');
}

/** Extract structured facts from the AI response tail (engine input fallback). */
function parseExtracted(text) {
  const m = String(text || '').match(/EXTRACTED:\s*outcome=([^\s]+)\s+rr=([^\s]+)\s+pips=([^\s]+)/i);
  if (!m) return null;
  return { outcome: m[1], rr: m[2], pips: m[3] };
}

/** Strip the EXTRACTED line from what the user sees. */
function stripExtracted(text) {
  return String(text || '').replace(/EXTRACTED:.*$/i, '').trim();
}

/**
 * Analyze a completed session. Returns the coaching text (EXTRACTED line
 * stripped for display; parse it first via parseExtracted).
 */
async function analyzeSession({ session, user, system, recentSessions }) {
  if (!llm.available()) {
    return buildFallback(session, i18n.normalize(user && user.preferredLang));
  }
  const prep = prepareAnalysis({ session, user, system, recentSessions });
  return llm.callLLM(prep.systemPrompt, prep.messageContent, { maxTokens: 900 });
}

/** Shared prompt construction for analyzeSession / streamAnalysis. */
function prepareAnalysis({ session, user, system, recentSessions }) {
  const recentHistory = (recentSessions || []).slice(-10).reverse().map(s =>
    `- ${new Date(s.createdAt).toISOString().slice(0, 10)} [${s.sessionType}] ${s.outcome || ''}: ${(s.notes || '').slice(0, 140)}`
  ).join('\n');

  const scoreBrief = 'Score computed separately by the engine.';
  const messageContent = [{ type: 'text', text: 'Analyze this completed session.' }];
  // (chart image vision support arrives with the record stage upload wiring)
  const systemPrompt = buildSystemPrompt({ user, system, session, recentHistory, scoreBrief });
  return { systemPrompt, messageContent };
}

/**
 * Streaming variant of analyzeSession - yields coaching text chunks.
 * Same contract; without a provider key it yields the fallback in one chunk.
 * The EXTRACTED: tail may still arrive - the caller holds it back
 * (llm.createTailHoldback) and parses it.
 */
async function* streamAnalysis({ session, user, system, recentSessions }) {
  if (!llm.available()) {
    yield buildFallback(session, i18n.normalize(user && user.preferredLang));
    return;
  }
  const prep = prepareAnalysis({ session, user, system, recentSessions });
  yield* llm.streamLLM(prep.systemPrompt, prep.messageContent, { maxTokens: 900 });
}

/**
 * The weekly letter (spec §4.2) — the coach's short summary of the week.
 * Same contract as session analysis: NEVER a score line, no performance
 * claims, no integrity mechanics (rule 9). MindState context is the psych
 * integration: the letter may acknowledge what the trader has been working
 * on — in their own interest, privately.
 */
function buildWeeklyLetterPrompt({ user, system, weekSessions, movement, mindState }) {
  const stats = require('./weekly').weekStats(weekSessions);
  const dimLines = DIMENSION_ORDER.map(k => {
    const d = movement && movement.dimensions[k];
    if (!d) return null;
    const delta = d.delta == null ? 'building' : (d.delta > 0 ? `+${d.delta}` : String(d.delta));
    return `${k}: now ${d.now != null ? d.now : 'building'} (${delta} vs pre-week)`;
  }).filter(Boolean).join('\n');

  const themes = mindState && mindState.themes && mindState.themes.length
    ? mindState.themes.filter(t => t.status !== 'resolved').slice(0, 3).map(t =>
        `- ${t.name} [${t.status}]${t.note ? ` — ${t.note}` : ''}`).join('\n')
    : '';

  const sessionsLines = (weekSessions || []).slice(0, 10).map(s =>
    `- ${s.asset || '?'} (${s.sessionType || 'LIVE'}, ${s.outcome || '?'}, ${s.state}, ${s.ruleCompliance === true ? 'inside rules' : s.ruleCompliance === false ? 'broke rules' : 'rules not recorded'})`
  ).join('\n');

  return `You are KAIZEN (改), writing the weekly letter for ${user.username}. This is a private letter about their week of trading practice. It is read on one page, on a phone, with a cup of coffee.

HARD RULES:
- NEVER include a score line, percentage-as-judgment, or rank. Movement facts may be referenced plainly ("risk held steady"), but this letter is words, not numbers.
- No profit promises, no performance claims. Practice consistency is never trading performance.
- One page. Four short sections max. Warm, direct, zero flattery.
- LANGUAGE: write the letter in their language — their account language.
- VOICE: the letter speaks TO them — "your week", "your execution", "you held". Never third person ("the trader"), never bare noun phrases where possession matters ("execution held" → "your execution held").

THE WEEK:
Sessions: ${stats.total} (${stats.byType.LIVE} live, ${stats.byType.BACKTEST} backtest, ${stats.byType.STUDY} study)
Loop: ${stats.loopCompleted} fully analyzed, ${stats.loopOpen} still open
Inside rules: ${stats.complianceRate == null ? 'not recorded this week' : stats.compliant + ' of ' + stats.checked}
Dimension movement (background — reference at most one, in words):
${dimLines || 'no computed movement yet'}
Sessions this week:
${sessionsLines || 'none'}
${themes ? `What they have been working on psychologically (from private conversations — acknowledge only if the week's sessions reflect it, and gently):\n${themes}` : ''}
${system && system.name ? `Their system: "${system.name}" (v${system.version}).` : ''}

WRITE THE LETTER with exactly these sections, no headers needed:
1. Two-three sentences: the week in plain words.
2. The strongest moment — something specific they did.
3. The one pattern most worth attention next week — direct, not harsh.
4. One focus for next week, phrased as a process, not an outcome.`;
}

const DIMENSION_ORDER = ['process', 'risk', 'execution', 'behavior', 'learning'];

async function writeWeeklyLetter({ user, system, weekSessions, movement, mindState }) {
  if (llm.available()) {
    try {
      const raw = await llm.callLLM(
        buildWeeklyLetterPrompt({ user, system, weekSessions, movement, mindState }),
        'Write this week\'s letter.',
        { maxTokens: 900 }
      );
      return raw.trim();
    } catch (err) {
      console.error('Weekly letter API error:', err.message);
      // fall through to deterministic
    }
  }
  return buildWeeklyFallback({ weekSessions, movement, mindState, lang: i18n.normalize(user && user.preferredLang) });
}

/** Deterministic weekly letter (no API key) — honest, specific, never scored. */
function buildWeeklyFallback({ weekSessions, movement, mindState, lang = 'en' }) {
  const tr = (k, p) => i18n.t(lang, k, p);
  const stats = require('./weekly').weekStats(weekSessions);
  const parts = [];

  parts.push(tr('coach.wk.week', {
    total: stats.total, s: stats.total === 1 ? '' : 's',
    live: stats.byType.LIVE, backtest: stats.byType.BACKTEST, study: stats.byType.STUDY,
    done: stats.loopCompleted,
    open: stats.loopOpen ? tr('coach.wk.openNote', { open: stats.loopOpen }) : ''
  }));

  if (stats.complianceRate != null) {
    parts.push(stats.compliant === stats.checked
      ? tr('coach.wk.allIn')
      : tr('coach.wk.someIn', { compliant: stats.compliant, checked: stats.checked }));
  }

  const activeTheme = mindState && mindState.themes &&
    mindState.themes.find(t => t.status === 'active');
  if (activeTheme) {
    parts.push(tr('coach.wk.theme', { theme: activeTheme.name.toLowerCase() }));
  }

  const focusDim = movement && movement.dimensions &&
    ['risk', 'process', 'execution', 'behavior', 'learning'].find(k => movement.dimensions[k].delta != null && movement.dimensions[k].delta < 0);
  parts.push(focusDim
    ? (focusDim === 'learning' ? tr('coach.wk.focusLearning') : tr('coach.wk.focusDim', { dim: focusDim }))
    : tr('coach.wk.focus'));

  return parts.join('\n\n');
}

module.exports = { analyzeSession, streamAnalysis, parseExtracted, stripExtracted, buildFallback, buildSystemPrompt, writeWeeklyLetter, buildWeeklyFallback };
