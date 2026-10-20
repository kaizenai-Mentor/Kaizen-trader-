/**
 * services/improveCoach.js — Improvement Recommendations (owner
 * directive 19 Oct 2026): AI-generated, actionable suggestions based
 * on the trader's patterns, mistakes, and performance.
 *
 * Same contract as the other coaches:
 * - English only (owner directive 19 Oct 2026).
 * - Personal and second-person: talks about THEIR numbers, THEIR
 *   rules, THEIR words. Never generic advice, never market predictions.
 * - Without a provider key the deterministic fallback speaks — built
 *   from the trader's own record (worst dimension, rule breaks, psych
 *   theme), so the page is never empty and never canned.
 * - Machine tail (EXTRACTED-REC:) stays English and parseable.
 */
const llm = require('./llm');
const cleanText = require('./cleanText');

const DIM_LABELS = {
  process: 'Process',
  risk: 'Risk',
  execution: 'Execution',
  behavior: 'Behavior',
  learning: 'Learning & Consistency'
};

function dimLabel(k) {
  return DIM_LABELS[k] || k;
}

function lastSessions(sessions, n) {
  return (sessions || []).slice(-n);
}

function violationCount(sessions) {
  return sessions.filter(s => s && s.ruleCompliance === false).length;
}

function ruleQuote(system) {
  const rules = (system && (system.entryRules || system.rules || system.entry)) || '';
  const first = Array.isArray(rules) ? rules[0] : String(rules).split('\n')[0];
  return (first || '').trim();
}

function notesSnippet(session) {
  const raw = (session && session.notes) || '';
  const one = raw.split(/(?<=[.!?])\s/)[0] || raw;
  return one.length > 120 ? one.slice(0, 117) + '…' : one;
}

/**
 * System prompt. Deterministic markers below are test-pinned:
 * "one rule at a time", "PROPOSAL:", "EXTRACTED-REC:", "English".
 */
function buildSystemPrompt({ user, system, sessions, movement, mindState }) {
  const name = (user && user.username) || 'trader';
  const recent = lastSessions(sessions, 8).map(s =>
    `- [${s.sessionType || 'LIVE'}] ${s.outcome || 'no trade'} rules:${s.ruleCompliance === false ? 'BROKEN' : 'kept'} :: ${(s.notes || '').slice(0, 120)}`
  ).join('\n');

  const themes = (mindState && mindState.themes || [])
    .map(t => `${t.name} (${t.status})`).join(', ');

  const dims = movement && movement.dimensions
    ? Object.entries(movement.dimensions)
        .map(([k, v]) => `${dimLabel(k)}: now ${v.now == null ? '—' : v.now}${v.delta != null ? ` (${v.delta > 0 ? '+' : ''}${v.delta} vs prior)` : ''}`)
        .join('\n')
    : 'Not enough readings yet.';

  return `You are KAIZEN, the improvement coach inside a trader's journal. The trader's name is ${name}. You are not a signal service.

VOICE (non-negotiable):
1. Second person. Talk about THEIR record — quote their notes, their rule text, their numbers. "Your execution", never bare "execution".
2. Improvement is the only thing you sell: process, risk, execution, behavior, learning. Never price predictions, never entries or exits.
3. One rule at a time. Every recommendation must be doable in their very next session.
4. Honest, warm, adult. No emoji. No hype. No asterisks, no markdown. No templates that could fit any trader.

THEIR SYSTEM (what every session is measured against):
${system && (system.entryRules || system.rules) ? JSON.stringify(system.entryRules || system.rules) : 'No written system yet — say so, and make recommendation 1 about writing one.'}

THEIR RECENT SESSIONS (newest last):
${recent || 'None yet — recommendations should start with logging one honest session.'}

THEIR SCORE DIMENSIONS (computed by the engine, not by you):
${dims}

THEIR EMOTIONAL PATTERNS (private, captured inside the KAIZEN AI conversation):
${themes || 'None logged.'}

TASK — write 3 to 4 improvement recommendations. Exactly this shape, nothing else:

INTRO: one short paragraph in your voice, referencing something specific from their record above.

1. <short title>
   WHY: one or two sentences about their data — cite the numbers or their own words.
   PROPOSAL: one compelling, realistic, personal proposal — pitch it to them like a coach who has read every session: what changes, why it is realistic for them, and the one thing to do in their very next session. One rule at a time. Begin directly with the change itself — never a "My proposal:" prefix, the page carries the label.

2. <short title>
   WHY: ...
   PROPOSAL: ...

3. <short title>
   WHY: ...
   PROPOSAL: ...

(add a 4th only if their record clearly supports it)

At the very end add this line with facts extracted from the record (or none). It is machine-parsed: always write this line in English and in exactly this format, whatever else you wrote above:
EXTRACTED-REC: top=[process|risk|execution|behavior|learning|none] theme=[theme name or none]`;
}

/** Parse the structured recommendations + machine tail. */
function parseRecommendations(text) {
  const src = String(text || '');
  const tail = (src.match(/EXTRACTED-REC:\s*(.*)/) || [])[1] || '';
  const top = (tail.match(/top=\[?([a-z]+)\]?(?=\s+theme=|$)/) || [])[1] || 'none';
  const themeMatch = (tail.match(/theme=\[?([^\]\n]+?)\]?$/) || [])[1] || 'none';
  const body = src.replace(/EXTRACTED-REC:[\s\S]*$/, '').trim();

  const intro = cleanText((body.match(/INTRO:\s*([\s\S]*?)(?=\n\s*1\.)/) || [])[1] || '');
  const items = [];
  const re = /(\d+)\.\s*([^\n]+)\n\s*WHY:\s*([\s\S]*?)\n\s*(?:PROPOSAL|ACTION):\s*([\s\S]*?)(?=\n\s*\d+\.|$)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const proposal = cleanText(m[4])
      .replace(/^(?:my|our|kaizen'?s)\s+proposal\b\s*[:\-—]?\s*/i, '');
    items.push({
      title: cleanText(m[2]),
      why: cleanText(m[3]),
      proposal
    });
  }
  return { intro, items, extracted: { top: top.trim(), theme: themeMatch.trim() } };
}

function stripTail(text) {
  return String(text || '').replace(/\s*EXTRACTED-REC:[\s\S]*$/, '').trim();
}

/**
 * Deterministic fallback — personal, from their record. Test-pinned:
 * "of your last", the rule quote, "one rule at a time".
 */
function buildFallback({ user, system, sessions, movement, mindState } = {}) {
  const recent = lastSessions(sessions, 10);
  const violations = violationCount(recent);
  const rule = ruleQuote(system);
  const snippet = notesSnippet(recent[recent.length - 1]);

  // Worst / falling dimension.
  let worst = null;
  if (movement && movement.dimensions) {
    const entries = Object.entries(movement.dimensions)
      .filter(([, v]) => v && (v.now != null || v.delta != null));
    entries.sort((a, b) => {
      const aScore = a[1].now == null ? 101 : a[1].now;
      const bScore = b[1].now == null ? 101 : b[1].now;
      return aScore - bScore;
    });
    if (entries.length && entries[0][1].now != null) worst = entries[0];
  }

  const theme = mindState && (mindState.themes || [])
    .find(t => t.status === 'active' || t.status === 'improving');

  const parts = [];
  parts.push(snippet
    ? `You wrote: "${snippet}" That is the material we improve with — everything below is built from your own record, nothing generic.`
    : `Everything below is built from your own record — nothing generic.`);

  const items = [];

  if (recent.length === 0) {
    items.push({
      title: 'Log one honest session',
      why: 'Nothing has been recorded yet, so there is no pattern to read — the engine needs one full loop (plan → record → reflect) before it can see you.',
      proposal: 'Give the record one honest week — plan one session for your next market day, record what actually happened, and reflect in your own words. That one loop is what turns advice into something personal. One session at a time.'
    });
  } else if (!rule) {
    items.push({
      title: 'Write one entry rule you can point to on the chart',
      why: 'Your system has no written entry rule yet, so no session can be measured against anything — the engine cannot score adherence to a plan it cannot read.',
      proposal: 'Before your next session, write one entry rule in My Trading System — specific enough that you could point to its trigger on the chart. One rule, written once, that every session after can be measured against. One rule at a time.'
    });
  } else if (violations > 0) {
    items.push({
      title: 'Take one rule back into the next session',
      why: `${violations} of your last ${recent.length} recorded sessions broke a rule — and your own entry rule is: "${rule}"`,
      proposal: `Your next session has exactly one job — honouring the rule you wrote: "${rule}". Nothing else is scored. If the setup forces you past it, skip the trade and log the skip — that is the session doing its work. One rule at a time, and this is the one.`
    });
  } else if (recent.length > 0) {
    items.push({
      title: 'Protect the clean streak you just built',
      why: `Your last ${recent.length} recorded sessions stayed inside your rules — that is the behaviour that compounds, and it is fragile at the start.`,
      proposal: 'Treat the streak like something worth defending — before the next entry, read your entry rule out loud once and write the plan down before the session opens. One rule at a time keeps it.'
    });
  } else {
    items.push({
      title: 'Log one honest session',
      why: 'Nothing has been recorded yet, so there is no pattern to read — the engine needs one full loop (plan → record → reflect) before it can see you.',
      proposal: 'Give the record one honest week — plan one session for your next market day, record what actually happened, and reflect in your own words. One session at a time.'
    });
  }

  if (worst) {
    const [k, v] = worst;
    const deltaText = v.delta != null
      ? ` (${v.delta > 0 ? '+' : ''}${v.delta} versus your prior reading)`
      : '';
    items.push({
      title: `Move your ${dimLabel(k)} dimension first`,
      why: `Your ${dimLabel(k)} dimension is your lowest reading at ${v.now == null ? '—' : v.now}${deltaText} — this is the number your next sessions move fastest.`,
      proposal: k === 'risk'
        ? 'Risk is the dimension you can move this week without touching anything else — write the exact risk per trade and the daily stop before the session, and end the day the moment the daily stop hits. One rule at a time.'
        : k === 'learning'
          ? 'In your next reflection, name one mistake and one correction in your own words — a real one, from the session you just traded. That single sentence is what moves this dimension.'
          : `The plan is what moves ${dimLabel(k)} — write it before the entry and compare the trade to it afterwards. Honest comparison, one session at a time.`
    });
  }

  if (theme) {
    items.push({
      title: `Keep working the ${String(theme.name).toLowerCase()}`,
      why: `Your pattern layer is still on "${theme.name}" (${theme.status}) — this is what shows up in the sessions when nobody is watching.`,
      proposal: 'Name the trigger once before the next session starts — in a KAIZEN AI conversation or in the session note — and trade the plan despite it. Naming it first is what steals its power. One rule at a time.'
    });
  }

  return {
    intro: parts.join(' '),
    items: items.slice(0, 4),
    extracted: {
      top: worst ? worst[0] : 'none',
      theme: theme ? String(theme.name) : 'none'
    }
  };
}

/** Full path: real AI when a provider key is set, deterministic otherwise. */
async function recommend({ user, system, sessions, movement, mindState } = {}) {
  if (!llm.available()) {
    return buildFallback({ user, system, sessions, movement, mindState });
  }
  const systemPrompt = buildSystemPrompt({ user, system, sessions, movement, mindState });
  const text = await llm.callLLM(systemPrompt, [{ type: 'text', text: 'Write my improvement recommendations now.' }], { maxTokens: 900 });
  const parsed = parseRecommendations(text);
  if (!parsed.items.length) {
    return buildFallback({ user, system, sessions, movement, mindState });
  }
  return parsed;
}

module.exports = {
  buildSystemPrompt,
  buildFallback,
  parseRecommendations,
  stripTail,
  recommend
};
