/**
 * psychCoach — the Psychology conversation engine (V2, owner vision
 * 13 Sep 2026; spec docs/PAGE-SPEC.md §3.1).
 *
 * THE SURFACE: ChatGPT-style — the trader talks, KAIZEN listens and works on
 * the mind. The honest diagnosis: most rule breaks are symptoms; the mental
 * state is the cause. This service is where the cause gets worked on.
 *
 * CONTRACT (mirrors aiCoach.js):
 * - NEVER a score, never "DISCIPLINE SCORE" lines — psychology NEVER feeds
 *   the score (frozen). Behavioral patterns may be referenced; scores may not.
 * - The response may end with a PSYCH-STATE: tail — the self-maintaining
 *   memory update (owner decision D2). The server parses it, applies it to
 *   the MindState, and strips it from what the user sees.
 * - Deterministic fallback without an API key: honest, warm, never blank —
 *   plus a deterministic MindState updater so memory still grows.
 * - Coach, not therapist: stays in trading-performance psychology. Crisis
 *   language gets a caring human response pointing to real help — never
 *   diagnosis, never clinical claims.
 * - No mention of anti-gaming/integrity mechanics anywhere (rule 9).
 */

const https = require('https');

// ── Crisis language (checked before anything else) ───────────────
const CRISIS_RE = /suicid|kill(ing)? myself|end(ing)? (it all|my life)|self.?harm|hurt(ing)? myself|don'?t want to (be here|live|go on)|do not want to (be here|live|go on)|no reason to (live|go on)|better off dead/i;

const CRISIS_RESPONSE = [
  'What you just shared matters more than anything about trading, and I want to answer it honestly.',
  '',
  'I\'m an AI coach — I\'m not equipped to carry this with you, and you deserve support from a person who is. Please reach out right now to someone you trust, or to a local crisis line in your country. If you\'re in immediate danger, contact your local emergency number.',
  '',
  'You don\'t have to be okay to be welcome here. When you\'re ready — today, or another day — I\'ll be here to work on the trading side of things with you. But please talk to a real person first. That\'s the right trade.'
].join('\n');

// ── Prompt construction ──────────────────────────────────────────

function digestMindState(state) {
  if (!state) return 'No psychological profile yet — this is an early conversation.';
  const themes = (state.themes || []).map(t =>
    `- ${t.name} [${t.status || 'active'}] — seen ${t.occurrences || 1}×, first ${t.firstSeen ? new Date(t.firstSeen).toISOString().slice(0, 10) : '?'}${t.note ? `; ${t.note}` : ''}`
  ).join('\n');
  const triggers = (state.triggers || []).map(t => `- ${t.situation}${t.note ? ` — ${t.note}` : ''}`).join('\n');
  const helps = (state.helps || []).map(h => `- ${h.what}`).join('\n');
  return [
    state.summary ? `Current understanding: ${state.summary}` : 'Current understanding: still forming.',
    themes ? `Themes you have already recognized in this person (do not re-diagnose what is resolved; reference the history when it repeats):\n${themes}` : '',
    triggers ? `Known triggers:\n${triggers}` : '',
    helps ? `What has helped before:\n${helps}` : ''
  ].filter(Boolean).join('\n');
}

function digestRecentSessions(sessions) {
  if (!sessions || !sessions.length) return 'No trading sessions logged yet.';
  const last5 = sessions.slice(0, 5);
  const violations = last5.filter(s => !s.ruleCompliance).length;
  const losses = last5.filter(s => s.outcome === 'Loss').length;
  const types = last5.map(s => s.sessionType || 'LIVE');
  return `Last ${last5.length} sessions: ${violations} with broken rules, ${losses} losses, types ${types.join('/')}.`;
}

function digestSystem(system) {
  if (!system) return 'No trading system written yet.';
  const r = system.riskRules || {};
  return `Their system: "${system.name}" — risk/trade ${r.riskPerTrade || 'not set'}, max ${r.maxDailyTrades || '?'} trades/day, daily stop ${r.dailyDrawdown || 'not set'}, ${system.setups && system.setups.length ? system.setups.length + ' named setups' : 'no named setups yet'}.`;
}

function buildSystemPrompt({ user, system, sessions, mindState }) {
  return `You are KAIZEN (改) — the psychology side of a trading-improvement product. You are talking with ${user.username}, a trader, in a private conversation about their mind.

THIS IS NOT TRADE ANALYSIS. It is a psychology conversation. Most of the time it is not the rules that fail — the trader's state is what needs work. The rule-break is the symptom; the state is the cause. Your job is the cause.

WHAT YOU KNOW ABOUT THIS TRADER (use it naturally, never list it back):
${digestSystem(system)}
${digestRecentSessions(sessions)}
${digestMindState(mindState)}

HOW YOU TALK:
1. Listen first — reflect back what they actually said before anything else.
2. Ask ONE question that goes deeper. Never more than one.
3. Name patterns you have seen in THIS person (their history above), not generic listicles. If a theme repeats, say when you first saw it — memory is your gift to them.
4. When they report improvement, take note warmly — progress deserves witness.
5. No trade signals, no market analysis, no strategy advice here.
6. Warm but honest. Like a mentor who has seen everything and judges nothing.
7. Short paragraphs. Under 250 words. Vary your openings; never start with "I".
8. You are a coach, NOT a therapist or emergency service. Trading-performance psychology only. If their distress goes beyond trading (real crisis, self-harm, hopelessness), stop coaching: tell them, with care, to talk to a person they trust or a local crisis line. No diagnosis, no clinical language.
9. NEVER mention scores, percentages, or anything that sounds like measurement. This room has no scoreboard — nothing here is counted, ranked, or rewarded.

YOUR MEMORY (self-maintaining, owner design):
After your reply, append a PSYCH-STATE block (the user never sees it). Keep it current and honest:

PSYCH-STATE:
SUMMARY: <2-3 sentences — your current overall understanding of this trader's state>
THEME: <pattern name, short> | <active|improving|resolved> | <one-line note>
TRIGGER: <situation that precedes trouble for this person> | <one-line note>
HELP: <something that actually helped in this conversation> | <one-line note>

Rules for the block: include SUMMARY always. Include THEME/TRIGGER/HELP lines only when this conversation gives you evidence for them (repeat a THEME line to update its status — e.g. improving). Never invent. Never delete history — status changes carry the story.`;
}

// ── PSYCH-STATE tail parsing (mirrors aiCoach's EXTRACTED pattern) ──

function parsePsychState(text) {
  const out = { summary: '', themes: [], triggers: [], helps: [] };
  if (!text) return out;
  const idx = text.indexOf('PSYCH-STATE:');
  if (idx === -1) return out;
  const lines = text.slice(idx + 'PSYCH-STATE:'.length).split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const sm = line.match(/^SUMMARY:\s*(.+)$/i);
    if (sm) { out.summary = sm[1].trim(); continue; }
    const tm = line.match(/^THEME:\s*(.+)$/i);
    if (tm) {
      const [name, status, ...note] = tm[1].split('|').map(s => s.trim());
      if (name) out.themes.push({
        name, status: ['active', 'improving', 'resolved'].includes(status) ? status : 'active',
        note: note.join(' | ')
      });
      continue;
    }
    const tg = line.match(/^TRIGGER:\s*(.+)$/i);
    if (tg) {
      const [situation, ...note] = tg[1].split('|').map(s => s.trim());
      if (situation) out.triggers.push({ situation, note: note.join(' | ') });
      continue;
    }
    const hp = line.match(/^HELP:\s*(.+)$/i);
    if (hp) {
      const [what, ...note] = hp[1].split('|').map(s => s.trim());
      if (what) out.helps.push({ what, note: note.join(' | ') });
    }
  }
  return out;
}

/** Remove the tail from what the user sees. */
function stripPsychState(text) {
  if (!text) return '';
  const idx = text.indexOf('PSYCH-STATE:');
  return (idx === -1 ? text : text.slice(0, idx)).trim();
}

// ── The MindState self-update (D2: permanent, never deletes) ─────

function applyPsychState(mindState, parsed, now = new Date()) {
  if (!mindState || !parsed) return mindState;

  if (parsed.summary && parsed.summary !== mindState.summary) {
    mindState.summary = parsed.summary;
    mindState.summaryHistory.push({ at: now, summary: parsed.summary });
    if (mindState.summaryHistory.length > 50) mindState.summaryHistory.shift();
  }

  for (const t of parsed.themes || []) {
    const existing = mindState.themes.find(x =>
      x.name.toLowerCase().trim() === t.name.toLowerCase().trim());
    if (existing) {
      existing.lastSeen = now;
      existing.occurrences = (existing.occurrences || 1) + 1;
      if (t.status) existing.status = t.status;
      if (t.note) existing.note = t.note;
    } else {
      mindState.themes.push({
        name: t.name, status: t.status || 'active', note: t.note || '',
        firstSeen: now, lastSeen: now, occurrences: 1
      });
    }
  }

  for (const t of parsed.triggers || []) {
    const existing = mindState.triggers.find(x =>
      x.situation.toLowerCase().trim() === t.situation.toLowerCase().trim());
    if (existing) {
      existing.lastSeen = now;
      if (t.note) existing.note = t.note;
    } else {
      mindState.triggers.push({ situation: t.situation, note: t.note || '', firstSeen: now, lastSeen: now });
    }
  }

  for (const h of parsed.helps || []) {
    const existing = mindState.helps.find(x =>
      x.what.toLowerCase().trim() === h.what.toLowerCase().trim());
    if (existing) {
      existing.lastSeen = now;
      if (h.note) existing.note = h.note;
    } else {
      mindState.helps.push({ what: h.what, note: h.note || '', lastSeen: now });
    }
  }

  return mindState;
}

// ── Deterministic fallbacks (no API key) ─────────────────────────

const FALLBACK_THEMES = [
  { re: /revenge|frustrat|angry|tilt/i, name: 'Revenge after losses' },
  { re: /fomo|chase|chasing|missed (the|a)/i, name: 'FOMO / chasing moves' },
  { re: /anxious|anxiety|nervous|scared|afraid|fear|panic/i, name: 'Fear / anxiety around trading' },
  { re: /overconfiden|invincib|euphori|on fire|can'?t lose/i, name: 'Overconfidence after wins' },
  { re: /bored|boredom|nothing to do/i, name: 'Boredom trading' },
  { re: /tired|exhaust|sleep|burn(ed|t)? out/i, name: 'Fatigue / burnout' },
  { re: /pressure|bills|rent|need the money|financial/i, name: 'Financial pressure' },
  { re: /doubt|hesitat|second.guess|trust myself/i, name: 'Self-doubt at entry' }
];

function deterministicState(userMessage) {
  const msg = (userMessage || '').toLowerCase();
  const themes = FALLBACK_THEMES.filter(t => t.re.test(msg)).map(t => t.name);
  return { summary: '', themes: themes.map(name => ({ name, status: 'active', note: '' })), triggers: [], helps: [] };
}

function buildFallback({ userMessage, mindState, sessions }) {
  const msg = (userMessage || '').toLowerCase();
  const named = (mindState && mindState.themes && mindState.themes.length)
    ? mindState.themes.find(t => t.status !== 'resolved') : null;
  const violations = sessions && sessions.length
    ? sessions.slice(0, 5).filter(s => !s.ruleCompliance).length : 0;

  const parts = [];
  parts.push('Thank you for putting that into words. Most people never say this stuff out loud — writing it down is already the first move.');

  if (named) {
    parts.push(`This connects to something we have talked about before: ${named.name.toLowerCase()}. Patterns like this rarely visit once; recognizing it returning is the skill you are building.`);
  } else if (/pressure|bills|rent|need the money|financial/.test(msg)) {
    parts.push('Trading from financial need is one of the hardest states to trade from. When the outcome matters that much, every decision gets made twice — once by you, once by the need. The work is shrinking the size until the need goes quiet.');
  } else if (/anxious|anxiety|nervous|scared|afraid|panic/.test(msg)) {
    parts.push('That feeling before the chart opens is not weakness — it is your nervous system asking whether it is safe. The question is never how to delete the feeling; it is how to make decisions it does not get to vote on.');
  } else if (/loss|losing|lost|blew/.test(msg)) {
    parts.push('The thirty minutes after a loss are where accounts actually die — not from the loss, from what gets traded in reaction to it. What you do in that window is the real skill.');
  } else if (/doubt|hesitat|missed/.test(msg)) {
    parts.push('Doubt at entry usually means the trust is being asked to live in the moment, when it actually lives in the repetition. You do not need certainty on this trade; you need a process you would follow twenty more times.');
  } else {
    parts.push('Whatever is sitting under what you wrote — the thing you almost typed and deleted — that is usually where the work is.');
  }

  if (violations >= 3) {
    parts.push(`One honest note from your record: rules were broken in ${violations} of your last five sessions. When that much structure bends, the rules are rarely the problem — the state they are being asked to hold is.`);
  }

  parts.push('What is the feeling underneath it — fear of losing, fear of missing, or something the market is just borrowing from the rest of your life?');
  return parts.join('\n\n');
}

// ── Conversation entry point ─────────────────────────────────────

async function converse({ user, system, sessions, mindState, threadMessages = [], userMessage }) {
  // Crisis lane — before anything else, no AI involved.
  if (CRISIS_RE.test(userMessage || '')) {
    return {
      reply: CRISIS_RESPONSE,
      psychState: { summary: '', themes: [{ name: 'Crisis — professional support recommended', status: 'active', note: 'Pointed to real human help.' }], triggers: [], helps: [] }
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      // Thread context: the last 12 messages keep the conversation coherent.
      const history = (threadMessages || []).slice(-12).map(m =>
        `${m.role === 'user' ? 'THEM' : 'YOU'}: ${m.text}`).join('\n');
      const systemPrompt = buildSystemPrompt({ user, system, sessions, mindState });
      const content = (history ? `CONVERSATION SO FAR:\n${history}\n\nTHEY JUST SAID:\n${userMessage}` : userMessage);

      const raw = await callClaude(systemPrompt, content, 700);
      return { reply: stripPsychState(raw), psychState: parsePsychState(raw) };
    } catch (err) {
      console.error('psychCoach API error:', err.message);
      // fall through to deterministic
    }
  }

  return {
    reply: buildFallback({ userMessage, mindState, sessions }),
    psychState: deterministicState(userMessage)
  };
}

function callClaude(systemPrompt, messageContent, maxTokens) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens || 700,
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
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(payload);
    req.end();
  });
}

module.exports = {
  converse,
  parsePsychState,
  stripPsychState,
  applyPsychState,
  buildFallback,
  CRISIS_RESPONSE
};
