/**
 * services/goalCoach.js — Goal Guidance (owner directive 19 Oct 2026):
 * AI assistance for setting, tracking and adapting trading improvement
 * goals over time.
 *
 * Same contract as the other coaches:
 * - English only. Personal — their numbers, their rule text, their words.
 *   Guidance answers the goal AS THEY WROTE IT: it quotes their title
 *   and their why, then checks it against the record (owner directive
 *   20 Oct 2026: "the guidance should be realistic and not just for
 *   having a guidance sake").
 * - Goals are behaviour targets, never profit targets. No market
 *   predictions, ever.
 * - Goals are the trader's own. KAIZEN never proposes or suggests
 *   goals (owner directive 20 Oct 2026) — it only guides the ones
 *   they set.
 * - Deterministic fallback without a provider key: the guidance is
 *   computed from the record itself, so tracking always works.
 * - One rule at a time: next steps are doable in the very next session.
 */
const llm = require('./llm');
const cleanText = require('./cleanText');

const METRIC_LABELS = {
  RULE_COMPLIANCE: 'sessions inside your rules',
  SESSIONS_PER_WEEK: 'sessions logged per week',
  RISK_LIMIT: 'sessions that respected your risk limits',
  JOURNAL_STREAK: 'journal days in a row',
  PROP_FIRM: 'evaluation sessions inside your limits',
  CUSTOM: 'logged progress points'
};

/** Prop-firm goals (owner directive 19 Oct 2026): KAIZEN coaches the
 *  discipline and accountability an evaluation measures — NEVER trading
 *  insights, signals, or market opinions. The words cover how traders
 *  actually phrase it ("pass my Naira trader prop account"). */
const PROP_FIRM_RE = /\b(prop(\s*(firm|account|challenge|evaluation|trader|trading))?|propfirm|evaluation|challenge|funded(\s*(account|trader|trading))?|funding|ftmo|the5ers|myforex|e8\s*markets|surge|trueforex|audacity|alpha\s*capital|funded\s*trader|get\s*funded|stay\s*funded)\b/i;

function isPropFirmGoal(goal) {
  if (!goal) return false;
  if (goal.metric === 'PROP_FIRM') return true;
  return PROP_FIRM_RE.test(String(goal.title || '') + ' ' + String(goal.rationale || ''));
}

function metricLabel(m) {
  return METRIC_LABELS[m] || METRIC_LABELS.CUSTOM;
}

/** Daily feedback, newest first — the process evidence the coach gauges from. */
function feedbackLines(goal, n = 5) {
  const entries = (goal && goal.progressLog) || [];
  return entries.slice(-Math.max(1, n)).reverse().map(e => {
    const when = e && e.at ? new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const val = e && e.value != null ? `value ${e.value}${(goal && goal.unit) || ''}` : 'no value';
    return `- [${when}] ${val} :: ${cleanText(e && e.note) || '(no note)'}`;
  });
}

/** The reminder rule (owner directive 21 Oct 2026): an ACTIVE goal with
 *  no feedback entry today is due — the dashboard and the goals list
 *  both nudge from this one source of truth. */
function feedbackDueToday(goal, now = new Date()) {
  if (!goal || goal.status !== 'ACTIVE') return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return !(goal.progressLog || []).some(e => e && e.at && new Date(e.at) >= start);
}

/** Their feedback appended to the assessment: quote the latest words and
 *  gauge the movement across entries — that is the accountability loop. */
function feedbackFoot(goal) {
  const entries = (goal && goal.progressLog) || [];
  if (!entries.length) return '';
  const latest = entries[entries.length - 1];
  const when = latest && latest.at
    ? new Date(latest.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const quote = cleanText(latest && latest.note);
  const values = entries.filter(e => e && e.value != null).map(e => e.value);
  const move = values.length >= 2 && values[values.length - 1] !== values[0]
    ? ` Your logged value moved ${values[0]}${goal.unit || ''} \u2192 ${values[values.length - 1]}${goal.unit || ''} across ${values.length} entries.`
    : '';
  const said = quote ? ` Your feedback${when ? ` from ${when}` : ''}: \u201C${quote}\u201D.` : '';
  return `${said}${move}`;
}

/** Their why, in their words — the anchor every assessment quotes. */
function whyLine(goal) {
  const why = cleanText(goal && goal.rationale);
  return why ? ` Your why, exactly as you put it: "${why}".` : '';
}

function lastSessions(sessions, n) {
  return (sessions || []).slice(-n);
}

/** Checked = sessions where the rule question was answered. */
function complianceRate(sessions) {
  const checked = sessions.filter(s => s && s.ruleCompliance === true || s && s.ruleCompliance === false);
  if (!checked.length) return { value: null, kept: 0, checked: 0 };
  const kept = checked.filter(s => s.ruleCompliance === true).length;
  return { value: Math.round((kept / checked.length) * 100), kept, checked: checked.length };
}

function sessionsThisWeek(sessions, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  return sessions.filter(s => s && s.createdAt && new Date(s.createdAt) >= weekAgo).length;
}

function journalStreak(sessions, now = new Date()) {
  const days = new Set((sessions || [])
    .filter(s => s && s.createdAt)
    .map(s => new Date(s.createdAt).toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date(now);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    else if (streak === 0 && key === now.toISOString().slice(0, 10)) {
      // today not logged yet — keep looking back
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else break;
    if (streak > 365) break;
  }
  return streak;
}

/** Current value for a goal's metric, from the record. */
function currentValue(goal, sessions, now = new Date()) {
  switch (goal.metric) {
    case 'RULE_COMPLIANCE': {
      const recent = lastSessions(sessions, 10);
      return complianceRate(recent).value;
    }
    case 'SESSIONS_PER_WEEK':
      return sessionsThisWeek(sessions, now);
    case 'RISK_LIMIT': {
      const recent = lastSessions(sessions, 10);
      const checked = recent.filter(s => s && s.quickChecks && s.quickChecks.respectedRisk);
      if (!checked.length) return null;
      const kept = checked.filter(s => s.quickChecks.respectedRisk === 'YES').length;
      return Math.round((kept / checked.length) * 100);
    }
    case 'JOURNAL_STREAK':
      return journalStreak(sessions, now);
    case 'PROP_FIRM': {
      // The accountable behaviour: recent sessions inside their risk
      // limits (respect-risk answers first, the rule answer as fallback).
      const recent = lastSessions(sessions, 10);
      const risk = recent.filter(s => s && s.quickChecks && s.quickChecks.respectedRisk);
      if (risk.length) {
        return Math.round((risk.filter(s => s.quickChecks.respectedRisk === 'YES').length / risk.length) * 100);
      }
      return complianceRate(recent).value;
    }
    default: {
      const last = (goal.progressLog || [])[goal.progressLog.length - 1];
      return last ? last.value : null;
    }
  }
}

/**
 * Guidance for one goal: track it against the record and say how to
 * adapt. Deterministic and personal — it answers the goal in the
 * trader's own words, not a generic template. Test pins: gap language
 * with their numbers, "one rule at a time".
 */
function guide({ goal, user, system, sessions, movement, mindState, now = new Date() } = {}) {
  if (!goal) return { assessment: 'No goal yet.', nextStep: 'Set one small goal — one rule at a time.' };

  const recent = lastSessions(sessions, 10);
  const current = currentValue(goal, sessions, now);
  const comp = complianceRate(recent);
  const target = goal.target;
  const title = cleanText(goal.title) || 'this goal';

  let assessment;
  let nextStep;

  if (isPropFirmGoal(goal)) {
    // Discipline and accountability only — the boundary is the product.
    const riskNow = currentValue({ metric: 'PROP_FIRM' }, sessions, now);
    const compNow = complianceRate(recent);
    if (riskNow == null) {
      assessment = `"${title}" is an evaluation goal — and evaluations are passed by discipline, not by ideas: the daily loss limit, the max drawdown, and your own written rules. The record needs sessions with the risk question answered before the tracking is honest.${whyLine(goal)}`;
      nextStep = 'Log your next session with the risk question answered — inside the limit or not, say so. Accountability starts with one honest entry. One rule at a time.';
    } else {
      assessment = `"${title}" — funded accounts are earned by staying inside the limits when it hurts: the daily loss limit, the max drawdown, and your own written rules. Your recent record: ${riskNow}% of your checked sessions held those limits${compNow.checked ? ` — ${compNow.kept} of your last ${compNow.checked} stayed inside your rules overall` : ''}. I coach the discipline and accountability your evaluation measures — never what to trade.${whyLine(goal)}`;
      nextStep = goal.metric === 'PROP_FIRM' && goal.target != null && riskNow >= goal.target
        ? `You are meeting "${title}". Hold the standard: pre-set the daily loss limit before the next session and end the day when it hits — that habit is what funding desks actually evaluate. One rule at a time.`
        : `In the next session the job is not profit — it is finishing inside the daily loss limit and your entry rule, the two things this goal actually rides on. Write the plan first, log it either way. One rule at a time.`;
    }
    return { assessment: assessment + feedbackFoot(goal), nextStep };
  }

  if (current == null || target == null) {
    assessment = `"${title}" has no readable number yet — the record needs one honest measurement against it before guidance can be real. ${target != null ? `You set the bar at ${target}${goal.unit || ''}${goal.cadence === 'MONTHLY' ? ' a month' : ' a week'} — the next logged value starts the track.` : 'Log a progress value after each session and the track starts itself.'}${whyLine(goal)}`;
    nextStep = 'Log the next session with the rule question answered, and the tracking starts itself. One rule at a time.';
  } else {
    const gap = Math.round((target - current) * 10) / 10;
    if (gap > 0) {
      assessment = `You are at ${current}${goal.unit || ''} on "${title}" — ${gap}${goal.unit || ''} short of the ${target}${goal.unit || ''} target.${comp.checked ? ` Behind the number: ${comp.kept} of your last ${comp.checked} recorded sessions stayed inside your rules.` : ''}${whyLine(goal)}`;
      nextStep = goal.metric === 'RULE_COMPLIANCE' && comp.checked
        ? `In the next session, protect exactly one rule — the one written as your entry rule — and log the session either way. One rule at a time closes this gap.`
        : `Choose the smallest step that moves "${title}" once — in the very next session, not the next month. One rule at a time.`;
    } else if (goal.status === 'ACHIEVED') {
      assessment = `"${title}" is marked achieved at ${current}${goal.unit || ''}. The behaviour held — that is the win worth keeping.${whyLine(goal)}`;
      nextStep = 'Keep the same standard for two more weeks before you raise the bar. Steady beats stretched.';
    } else {
      assessment = `You are at ${current}${goal.unit || ''} against a ${target}${goal.unit || ''} target on "${title}" — the goal is being met.${whyLine(goal)}`;
      nextStep = 'Hold this standard. If it holds for two more weeks, tighten the target by one step — never by two.';
    }
  }

  return { assessment: assessment + feedbackFoot(goal), nextStep };
}

/** System prompt for the LLM path of goal guidance (structure pins). */
function buildGuidePrompt({ goal, user, system, sessions, movement, mindState }) {
  return `You are KAIZEN, the goal coach inside a trader's improvement journal. English only.

VOICE: second person, their numbers and their words, warm and honest. Goals are behaviour targets — never profit targets. No market predictions, no trading insights, no signals, no market opinions — for prop-firm goals KAIZEN coaches ONLY the discipline and accountability the evaluation measures (daily loss limit, max drawdown, consistency, the trader's own written rules). One rule at a time: the next step must be doable in the very next session. No asterisks, no markdown.

GOAL: ${goal.title} (metric: ${goal.metric}, target: ${goal.target}${goal.unit || ''}, cadence: ${goal.cadence}, status: ${goal.status})
THEIR WHY, AS THEY WROTE IT: ${goal.rationale || 'not written'}
RECENT SESSIONS:
${lastSessions(sessions, 10).map(s => `- [${s.sessionType || 'LIVE'}] rules:${s.ruleCompliance === false ? 'BROKEN' : 'kept'} :: ${(s.notes || '').slice(0, 100)}`).join('\n') || 'None yet.'}
DAILY FEEDBACK (their own words, newest first):
${feedbackLines(goal).join('\n') || 'None yet.'}

Write exactly this shape — answer THIS goal in the trader's own words, never a template that could fit any goal:

ASSESSMENT: one short paragraph tracking the goal against the record. Quote the goal's title and their why; cite one real number from their record; gauge the process from their daily feedback — if they named an obstacle, acknowledge it in their words.
NEXT: one concrete next step for the very next session.`;
}

function parseGuide(text) {
  const src = String(text || '');
  const assessment = cleanText((src.match(/ASSESSMENT:\s*([\s\S]*?)(?=\n\s*NEXT:)/) || [])[1] || '');
  const nextStep = cleanText((src.match(/NEXT:\s*([\s\S]*?)$/) || [])[1] || '');
  return { assessment, nextStep };
}

/** LLM path with deterministic fallback. */
async function guideAsync(ctx) {
  if (!llm.available()) return guide(ctx);
  try {
    const text = await llm.callLLM(
      buildGuidePrompt(ctx),
      [{ type: 'text', text: 'Guide me on this goal now.' }],
      { maxTokens: 500 }
    );
    const parsed = parseGuide(text);
    if (parsed.assessment && parsed.nextStep) return parsed;
  } catch (e) { /* fall through to the deterministic guide */ }
  return guide(ctx);
}

module.exports = {
  isPropFirmGoal,
  guide,
  guideAsync,
  buildGuidePrompt,
  parseGuide,
  feedbackLines,
  feedbackDueToday,
  currentValue,
  complianceRate,
  sessionsThisWeek,
  journalStreak
};
