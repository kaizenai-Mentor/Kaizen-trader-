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

const https = require('https');

function callClaude(systemPrompt, messageContent) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 900,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.content[0] && parsed.content[0].text) {
            resolve(parsed.content[0].text);
          } else {
            reject(new Error('Unexpected Anthropic response shape'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

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

WHAT YOU EXECUTED WELL
[specific]

WHERE THE BREAKDOWN OCCURRED
[real cause]

THE PATTERN KAIZEN IS TRACKING
[only if a genuine cross-session pattern exists]

ONE THING TO FOCUS ON
[single specific action — must vary every session]

At the very end add this line with facts extracted from their writing (or N/A):
EXTRACTED: outcome=[Win/Loss/Breakeven/No Trade] rr=[e.g. 1:2.5 or N/A] pips=[e.g. +45 or N/A]`;
}

function buildFallback(session) {
  const planned = session.plan && !session.plan.skipped;
  const followed = session.quickChecks && session.quickChecks.followedPlan === 'YES';
  const parts = [];
  parts.push('WHAT YOU EXECUTED WELL');
  if (planned && followed) {
    parts.push('You declared this trade before entering it and then traded it as declared. That closed loop — plan, execute, record — is the discipline the score is built from. Name it and protect it.');
  } else if (!planned) {
    parts.push('You logged the session honestly, including trading without a plan. Honest records beat flattering ones — this entry is usable.');
  } else {
    parts.push('You planned this trade before entering. The plan exists, and that is what makes the deviation visible and fixable.');
  }
  parts.push('\nONE THING TO FOCUS ON');
  if (!planned) {
    parts.push('Make your next session a planned one — declare the setup, invalidation, and risk before you enter. Thirty seconds, before the trade.');
  } else if (!followed) {
    parts.push('Reread your declared invalidation before your next entry. The plan you wrote is the standard — trade it or rewrite it between sessions, never during.');
  } else {
    parts.push('Repeat exactly this loop tomorrow: declare, execute as declared, record, reflect. Consistency is the edge.');
  }
  parts.push('\nEXTRACTED: outcome=' + (session.outcome || 'N/A') + ' rr=N/A pips=N/A');
  return parts.join('\n');
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
  const recentHistory = (recentSessions || []).slice(-10).reverse().map(s =>
    `- ${new Date(s.createdAt).toISOString().slice(0, 10)} [${s.sessionType}] ${s.outcome || ''}: ${(s.notes || '').slice(0, 140)}`
  ).join('\n');

  const scoreBrief = 'Score computed separately by the engine.';

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallback(session);
  }

  const messageContent = [{ type: 'text', text: 'Analyze this completed session.' }];
  // (chart image vision support arrives with the record stage upload wiring)
  const systemPrompt = buildSystemPrompt({ user, system, session, recentHistory, scoreBrief });
  return callClaude(systemPrompt, messageContent);
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
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const raw = await callClaude(
        buildWeeklyLetterPrompt({ user, system, weekSessions, movement, mindState }),
        'Write this week\'s letter.'
      );
      return raw.trim();
    } catch (err) {
      console.error('Weekly letter API error:', err.message);
      // fall through to deterministic
    }
  }
  return buildWeeklyFallback({ weekSessions, movement, mindState });
}

/** Deterministic weekly letter (no API key) — honest, specific, never scored. */
function buildWeeklyFallback({ weekSessions, movement, mindState }) {
  const stats = require('./weekly').weekStats(weekSessions);
  const parts = [];

  parts.push(`This week: ${stats.total} session${stats.total === 1 ? '' : 's'} — ${stats.byType.LIVE} live, ${stats.byType.BACKTEST} backtest, ${stats.byType.STUDY} study. ${stats.loopCompleted} made it all the way through the loop${stats.loopOpen ? `, ${stats.loopOpen} still waiting to be finished` : ''}.`);

  if (stats.complianceRate != null) {
    parts.push(stats.compliant === stats.checked
      ? 'Every recorded session stayed inside your rules. Protect whatever conditions made that possible — they are the real edge.'
      : `${stats.compliant} of ${stats.checked} recorded sessions stayed inside your rules. The misses are the curriculum — each one has a reason underneath it.`);
  }

  const activeTheme = mindState && mindState.themes &&
    mindState.themes.find(t => t.status === 'active');
  if (activeTheme) {
    parts.push(`You have been working on ${activeTheme.name.toLowerCase()} in your conversations — watch whether next week's sessions show it too. The chart is where the inner work becomes visible.`);
  }

  const focusDim = movement && movement.dimensions &&
    ['risk', 'process', 'execution', 'behavior', 'learning'].find(k => movement.dimensions[k].delta != null && movement.dimensions[k].delta < 0);
  parts.push(focusDim
    ? `Next week, one focus: ${focusDim === 'learning' ? 'write the reflection before the day ends — even three lines' : focusDim + ', one rule at a time'}. Process, not outcome.`
    : 'Next week, one focus: finish what you start — every session that gets planned deserves its reflection. Process, not outcome.');

  return parts.join('\n\n');
}

module.exports = { analyzeSession, parseExtracted, stripExtracted, buildFallback, writeWeeklyLetter, buildWeeklyFallback };
