/**
 * tradeCoach — the KAIZEN AI conversation engine (V2, spec §3.2).
 *
 * THE SURFACE: the trading-side chat. Same conversational quality as the
 * Psychology room, aimed at the TRADES — review an entry against the
 * trader's own rules, read a chart, pressure-test a system version,
 * quiz them on their own rules.
 *
 * CONTRACT (mirrors psychCoach / aiCoach):
 * - NEVER a score, NEVER a signal. No predictions, no "should I buy X".
 *   KAIZEN teaches process in the trader's own system's language. Asked
 *   for a signal → decline honestly, redirect to their process.
 * - Knows: the Trading System (rules, setups, risk numbers, version),
 *   recent sessions (plan vs record, quick checks, outcomes), and the
 *   trader's own reflections. Does NOT read the MindState — the mind
 *   stays in the Psychology room (clean lanes). If the conversation
 *   turns psychological, gently point there.
 * - Crisis language gets the same caring response as the Psychology room.
 * - Deterministic fallback without an API key: honest process questions.
 * - No integrity-mechanics talk (rule 9).
 */

const https = require('https');
const { CRISIS_RE, CRISIS_RESPONSE } = require('./psychCoach');

// Signal-seeking language — declined and redirected to process.
const SIGNAL_RE = /should i (buy|sell|enter|trade|long|short)|what (should|do) i trade|is (btc|bitcoin|eth|ethereum|xau|gold|eurusd|nas|s&p)[a-z0-9]* (a )?(buy|sell|good)|buy or sell|which coin|which pair|best coin|pump|moon/i;

// Psychological depth language — better served by the Psychology room.
const MIND_RE = /i feel (anxious|depressed|angry|hopeless|scared|afraid|lost|broken)|my mental health|i'?m struggling (with life|to cope)|can'?t stop thinking about.*(loss|losing)|emotionally drained/i;

// ── Prompt construction ──────────────────────────────────────────

function digestSystem(system) {
  if (!system) return 'No trading system written yet — coach them to write rules before opinions.';
  const r = system.riskRules || {};
  const setups = (system.setups || []).map(s => s.name).join('; ') || 'none named yet';
  return [
    `System: "${system.name}" (v${system.version})`,
    `Market conditions: ${system.marketConditions || 'not stated'}`,
    `Setups: ${setups}`,
    `Entry rules: ${system.entryRules || 'not written'}`,
    `Exit rules: ${system.exitRules || 'not written'}`,
    `Risk: ${r.riskPerTrade || '?'} per trade, max ${r.maxDailyTrades || '?'} trades/day, daily stop ${r.dailyDrawdown || '?'}, max size ${r.maxPositionSize || '?'}`,
    `Hours: ${system.tradingHours || 'not set'}`,
    `No-trade conditions: ${(system.noTradeConditions || []).join('; ') || 'none written'}`,
    `Psychological rules: ${(system.psychologicalRules || []).join('; ') || 'none written'}`
  ].join('\n');
}

function digestSessions(sessions) {
  if (!sessions || !sessions.length) return 'No sessions logged yet.';
  return sessions.slice(0, 5).map(s => {
    const checks = s.quickChecks || {};
    const flags = [
      checks.followedPlan === 'NO' && 'broke plan',
      checks.respectedRisk === 'NO' && 'broke risk',
      checks.withinEntryCriteria === 'NO' && 'outside entry criteria'
    ].filter(Boolean).join(', ');
    return `- ${s.asset || '?'} (${s.sessionType || 'LIVE'}, ${s.outcome || '?'}${s.plan && s.plan.setup ? `, setup: ${s.plan.setup}` : ''}${flags ? `, ${flags}` : ''})`;
  }).join('\n');
}

function digestReflections(sessions) {
  const withRefl = (sessions || []).filter(s => s.reflection && s.reflection.learned).slice(0, 3);
  if (!withRefl.length) return 'No written reflections yet.';
  return withRefl.map(s =>
    `- On ${s.asset || 'a session'} they wrote they learned: "${String(s.reflection.learned).slice(0, 160)}"`
  ).join('\n');
}

function buildSystemPrompt({ user, system, sessions }) {
  return `You are KAIZEN (改) — the trading coach side of a trader-improvement product, in conversation with ${user.username}.

THIS IS THE TRADING ROOM. Freeform conversation about setups, entries, exits, rules, charts, process. The mind has its own room — if the conversation turns to deep emotional struggle, acknowledge it with care in one sentence and suggest the Psychology room; do not conduct a psychology session here.

WHAT YOU KNOW ABOUT THIS TRADER (use it; quote their own rules back when relevant — rule references in plain text):
${digestSystem(system)}

RECENT SESSIONS:
${digestSessions(sessions)}

WHAT THEY SAY THEY LEARNED (their words — quote them back when it helps):
${digestReflections(sessions)}

HOW YOU COACH:
1. Anchor everything to THEIR system. "Your entry rule says X — does this setup satisfy it?" If their system doesn't cover the question, say so and help them write the missing rule.
2. Review, don't instruct: read what they show you (including chart images) and respond with what their own rules would say. Teach the reasoning process.
3. If they ask for a signal, a prediction, or "what should I trade": decline honestly — you don't predict markets, and prediction is not the skill. Redirect to their process. Never soften this into a maybe.
4. One clear next step per reply. Short paragraphs. Under 250 words.
5. If they share a chart image, describe what you observe neutrally (structure, levels, in relation to their stated rules) — no direction calls.
6. Warm, direct, zero flattery. Never start with "I". No scores, no percentages as judgments — facts from their record are fine ("rules broken in 3 of your last 5") but numbers that sound like measurement are not.
7. You are building a trader who doesn't need you. Teach the checks, not the answers.

QUIZ MODE: when asked to quiz, ask ONE question about THEIR actual rules (from the system above) — specific, checkable, phrased so they must reason (not yes/no). Wait for their answer before the next one. When they answer, say what their system actually says, verbatim, and whether they got it.`;
}

function buildQuizPrompt({ user, system, sessions }) {
  const base = buildSystemPrompt({ user, system, sessions });
  return base + '\n\nTHEY JUST ASKED TO BE QUIZZED. Ask your single best quiz question now — one rule from their system, phrased so they must reason it through. If their system has no rules yet, ask them to write the first one instead.';
}

// ── Deterministic fallbacks (no API key) ─────────────────────────

function buildFallback({ userMessage, system, sessions, imageAttached }) {
  const msg = (userMessage || '').toLowerCase();
  const hasRules = system && (system.entryRules || (system.setups && system.setups.length));
  const parts = [];

  if (SIGNAL_RE.test(msg)) {
    parts.push('Honest answer: I do not predict markets, and I will not pick a direction for you. Anyone who does is selling you something.');
    parts.push(hasRules
      ? 'What I can do is sharper: tell me the setup you are looking at and I will hold it against your own entry rules — the ones you wrote. If it passes them, the trade speaks for itself. If it does not, no signal from me would make it better.'
      : 'Right now your system has no written entry rules — so there is nothing for me to check the idea against. Write your first entry rule in My Trading System and bring the idea back. That is the trade that matters today.');
  } else if (imageAttached) {
    parts.push('I cannot see the image in this mode, and I will not pretend to. Here is what still works: describe what you see — the level, the structure, where your entry would be — and I will check it against your written rules.');
  } else if (msg.includes('quiz')) {
    parts.push(hasRules
      ? `Quiz time, from your own book: your system says you risk ${system.riskRules && system.riskRules.riskPerTrade || '—'} per trade with a daily stop of ${system.riskRules && system.riskRules.dailyDrawdown || '—'}. Today you are down to your daily stop, and one more setup you love appears. Walk me through exactly what your rules do — and what you do if the rules and the urge disagree.`
      : 'Cannot quiz you yet — your system has no written rules, and I do not test memory, I test rules. Write your first one in My Trading System and I will quiz you on it daily.');
  } else {
    parts.push('Let me hold that against your book before I say anything.');
    if (hasRules) {
      parts.push(`Your entry rule reads: "${system.entryRules || (system.setups[0] && system.setups[0].name)}". Does what you just described satisfy it — every clause, not most of it?`);
      parts.push('If the honest answer is yes, the next check is risk: does the size you described fit within what your system allows? If either check fails, the conversation is not about whether the trade is good — it is about which rule you are about to negotiate with.');
    } else {
      parts.push('Before opinions, rules: your system does not have written entry rules yet. Write one — a single sentence a stranger could check a chart against. Bring this idea back after, and we will test it properly.');
    }
  }
  return parts.join('\n\n');
}

// ── Conversation entry point ─────────────────────────────────────

async function converse({ user, system, sessions, threadMessages = [], userMessage, imageDataUrl, mode }) {
  // Crisis lane — identical care on every coach surface.
  if (CRISIS_RE.test(userMessage || '')) {
    return { reply: CRISIS_RESPONSE };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const history = (threadMessages || []).slice(-12).map(m =>
        `${m.role === 'user' ? 'THEM' : 'YOU'}: ${m.text}`).join('\n');

      const systemPrompt = mode === 'quiz'
        ? buildQuizPrompt({ user, system, sessions })
        : buildSystemPrompt({ user, system, sessions });

      let content;
      if (imageDataUrl) {
        const mm = imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (mm) {
          content = [
            { type: 'image', source: { type: 'base64', media_type: mm[1], data: mm[2] } },
            { type: 'text', text: (history ? `CONVERSATION SO FAR:\n${history}\n\n` : '') + (userMessage || 'Review this chart against my rules.') }
          ];
        }
      }
      if (!content) {
        content = (history ? `CONVERSATION SO FAR:\n${history}\n\nTHEY JUST SAID:\n` : '') + (userMessage || '');
      }

      const raw = await callClaude(systemPrompt, content, 700);
      return { reply: raw.trim() };
    } catch (err) {
      console.error('tradeCoach API error:', err.message);
      // fall through to deterministic
    }
  }

  return {
    reply: buildFallback({ userMessage, system, sessions, imageAttached: !!imageDataUrl })
  };
}

function callClaude(systemPrompt, content, maxTokens) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens || 700,
      system: systemPrompt,
      messages: [{ role: 'user', content }]
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
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(payload);
    req.end();
  });
}

module.exports = {
  converse,
  buildFallback,
  digestSystem,
  digestSessions,
  SIGNAL_RE,
  MIND_RE
};
