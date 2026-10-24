/**
 * services/goalCoach.js — Goal Guidance & Pre-Session Coaching
 * (owner directives 19–21 Oct 2026):
 *
 * Instead of reading like a dry AI report, My Goals feels like your
 * coach meeting you before today's trading session:
 *   - Your Goal (target, reason, current pattern, progress)
 *   - What you're doing well
 *   - Your biggest obstacle (blockers)
 *   - Today's focus (next action: protect discipline, not profits)
 *
 * Contract:
 * - English only. Personal — their numbers, their rule text, their words.
 * - Goals are behaviour targets, never profit targets. No market
 *   predictions, ever.
 * - Goals are the trader's own. KAIZEN never proposes or suggests
 *   goals (owner directive 20 Oct 2026) — it only guides the ones
 *   they set.
 * - Prop-firm goals: discipline and accountability ONLY — never trading
 *   insights, signals, or market opinions.
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
 *  insights, signals, or market opinions. */
const PROP_FIRM_RE = /\b(prop(\s*(firm|account|challenge|evaluation|trader|trading))?|propfirm|evaluation|challenge|funded(\s*(account|trader|trading))?|funding|ftmo|the5ers|myforex|e8\s*markets|surge|trueforex|audacity|alpha\s*capital|funded\s*trader|get\s*funded|stay\s*funded)\b/i;

function isPropFirmGoal(goal) {
  if (!goal) return false;
  if (goal.metric === 'PROP_FIRM') return true;
  return PROP_FIRM_RE.test(String(goal.title || '') + ' ' + String(goal.rationale || ''));
}

/**
 * Infer how to measure a goal from the trader's own words so the UI
 * never forces them to pick a metric, target, or cadence (owner
 * directive 23 Oct 2026).
 */
function inferGoalMetric(title = '', rationale = '') {
  const text = `${title} ${rationale}`;
  if (PROP_FIRM_RE.test(text)) return 'PROP_FIRM';
  if (/\b(streak|every day|daily journal|days in a row)\b/i.test(text)) return 'JOURNAL_STREAK';
  if (/\b(risk|drawdown|daily loss|stop loss|sizing|position size)\b/i.test(text)) return 'RISK_LIMIT';
  if (/\b(sessions? (a|per|this) week|log \d+ sessions)\b/i.test(text)) return 'SESSIONS_PER_WEEK';
  return 'RULE_COMPLIANCE';
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
  const checked = (sessions || []).filter(s => s && (s.ruleCompliance === true || s.ruleCompliance === false));
  if (!checked.length) return { value: null, kept: 0, checked: 0 };
  const kept = checked.filter(s => s.ruleCompliance === true).length;
  return { value: Math.round((kept / checked.length) * 100), kept, checked: checked.length };
}

function sessionsThisWeek(sessions, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  return (sessions || []).filter(s => s && s.createdAt && new Date(s.createdAt) >= weekAgo).length;
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
 * Build the pre-session coach meeting fields (owner directive 21 Oct 2026):
 *   - What you're doing well (doingWell)
 *   - Your biggest obstacle (obstacle / blockers)
 *   - Today's focus (todaysFocus / nextAction)
 *   - Accountability breakdown (target, reason, currentPattern, progress)
 */
function buildPreSessionBrief({ goal, sessions, mindState, current, comp }) {
  const title = cleanText(goal && goal.title) || 'this goal';
  const entries = (goal && goal.progressLog) || [];
  const latestFeedback = entries.length ? entries[entries.length - 1] : null;
  const activeTheme = mindState && Array.isArray(mindState.themes)
    ? mindState.themes.find(t => t && (t.status === 'active' || t.status === 'improving'))
    : null;
  const recentNotes = lastSessions(sessions, 10).map(s => (s && s.notes) || '').join(' ');

  // 1. What you're doing well
  let doingWell;
  if (comp && comp.checked > 0 && comp.kept > 0) {
    doingWell = `You followed your trading rules in ${comp.kept} of your last ${comp.checked} sessions.${feedbackFoot(goal)}\nKeep protecting that habit.`;
  } else if (entries.length > 0) {
    doingWell = `You are showing up with honest daily feedback (${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} logged).${feedbackFoot(goal)}\nKeep protecting that habit.`;
  } else {
    doingWell = `You set a clear behavioural standard with "${title}".\nKeep protecting that habit from your very first logged session.`;
  }

  // 2. Your biggest obstacle (blockers)
  let obstacle;
  const hasRevengeSignal = (activeTheme && /revenge/i.test(activeTheme.name)) ||
    /\b(revenge|frustrat)/i.test(recentNotes);
  if (hasRevengeSignal) {
    obstacle = 'Your journal still shows revenge trading after frustrating outcomes.\nThat remains your biggest threat.';
  } else if (activeTheme) {
    obstacle = `Your journal still shows ${cleanText(activeTheme.name).toLowerCase()} when pressure rises.\nThat remains your biggest threat.`;
  } else if (latestFeedback && latestFeedback.note) {
    obstacle = `Your latest daily feedback named what stood in the way: "${cleanText(latestFeedback.note)}".\nThat remains your biggest threat.`;
  } else if (comp && comp.checked > comp.kept) {
    obstacle = `Your rules gave way in ${comp.checked - comp.kept} of your last ${comp.checked} recorded sessions — entering before confirmation or moving your stop.\nThat remains your biggest threat.`;
  } else {
    obstacle = 'Unlogged or rushed sessions where rules go unchecked.\nComplacency remains your biggest threat.';
  }

  // 3. Today's focus (next action)
  let todaysFocus;
  if (hasRevengeSignal || /revenge|frustrat/i.test(obstacle)) {
    todaysFocus = 'If frustration appears today,\nwalk away for 15 minutes before considering another trade.\nProtect discipline.\nNot profits.';
  } else if (isPropFirmGoal(goal)) {
    todaysFocus = 'Before you open the chart today,\nwrite your daily loss limit and step away for 15 minutes if frustration appears.\nProtect discipline.\nNot profits.';
  } else {
    todaysFocus = 'Before considering a trade today,\nread your written entry rule once and walk away for 15 minutes if frustration appears.\nProtect discipline.\nNot profits.';
  }

  // Accountability metadata (target, reason, current pattern, progress)
  const targetSummary = goal && goal.target != null
    ? `${goal.target}${goal.unit || ''} (${goal.cadence || 'WEEKLY'})`
    : (isPropFirmGoal(goal) ? 'Daily loss limit & rule compliance' : (goal && goal.cadence) || 'WEEKLY');
  const reasonSummary = cleanText(goal && goal.rationale) || 'Stay accountable to your written trading process.';
  const currentPattern = comp && comp.checked > 0
    ? `${comp.kept} of last ${comp.checked} sessions inside your rules (${comp.value}%)`
    : 'Building baseline from your next logged sessions';
  const progressSummary = current != null
    ? `${current}${(goal && goal.unit) || ''}${goal && goal.target != null ? ` of ${goal.target}${goal.unit || ''}` : ''}`
    : (entries.length ? `${entries.length} feedback ${entries.length === 1 ? 'entry' : 'entries'} logged` : 'Awaiting first reading');

  return {
    yourGoal: title,
    doingWell,
    obstacle,
    blockers: obstacle,
    todaysFocus,
    nextAction: todaysFocus,
    targetSummary,
    reasonSummary,
    currentPattern,
    progressSummary
  };
}

/**
 * Guidance for one goal: returns both the pre-session coach meeting
 * sections (yourGoal, doingWell, obstacle, todaysFocus, currentPattern,
 * progressSummary) AND the classic assessment/nextStep fields so every
 * existing caller and test pin continues to pass.
 */
function guide({ goal, user, system, sessions, movement, mindState, now = new Date() } = {}) {
  if (!goal) {
    return {
      assessment: 'No goal yet.',
      nextStep: 'Set one small goal — one rule at a time.',
      yourGoal: 'No goal yet',
      doingWell: 'Start by setting one behavioural goal.',
      obstacle: 'No goal on record yet.',
      todaysFocus: 'Set one clear process rule for today.\nProtect discipline.\nNot profits.'
    };
  }

  const recent = lastSessions(sessions, 10);
  const current = currentValue(goal, sessions, now);
  const comp = complianceRate(recent);
  const target = goal.target;
  const title = cleanText(goal.title) || 'this goal';

  let assessment;
  let nextStep;

  if (isPropFirmGoal(goal)) {
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
    const brief = buildPreSessionBrief({ goal, sessions, mindState, current: riskNow, comp: compNow });
    return Object.assign({}, brief, { assessment: assessment + feedbackFoot(goal), nextStep });
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

  const brief = buildPreSessionBrief({ goal, sessions, mindState, current, comp });
  return Object.assign({}, brief, { assessment: assessment + feedbackFoot(goal), nextStep });
}

/** System prompt for the LLM path of goal guidance (structure pins). */
function buildGuidePrompt({ goal, user, system, sessions, movement, mindState }) {
  return `You are KAIZEN, the accountability coach meeting the trader before today's session. English only.

VOICE: second person, their numbers and their words, warm and honest. Goals are behaviour targets — never profit targets. No market predictions, no trading insights, no signals, no market opinions — for prop-firm goals KAIZEN coaches ONLY the discipline and accountability the evaluation measures (daily loss limit, max drawdown, consistency, the trader's own written rules). One rule at a time: the next step must be doable in the very next session. No asterisks, no markdown.

GOAL: ${goal.title} (metric: ${goal.metric}, target: ${goal.target}${goal.unit || ''}, cadence: ${goal.cadence}, status: ${goal.status})
THEIR WHY, AS THEY WROTE IT: ${goal.rationale || 'not written'}
RECENT SESSIONS:
${lastSessions(sessions, 10).map(s => `- [${s.sessionType || 'LIVE'}] rules:${s.ruleCompliance === false ? 'BROKEN' : 'kept'} :: ${(s.notes || '').slice(0, 100)}`).join('\n') || 'None yet.'}
DAILY FEEDBACK (their own words, newest first):
${feedbackLines(goal).join('\n') || 'None yet.'}

Write this exact shape — answer THIS goal in the trader's own words, like a coach meeting them before today's session:

DOING WELL: two short lines on what they are doing well from their record (e.g. "You followed your trading rules in X of your last Y sessions. Keep protecting that habit.").
OBSTACLE: two short lines naming their biggest obstacle or blocker from their journal or feedback.
TODAY'S FOCUS: one concrete behavioural instruction for today's session, ending with "Protect discipline. Not profits."
ASSESSMENT: one short paragraph tracking the goal against the record. Quote the goal's title and their why; cite one real number from their record; gauge the process from their daily feedback — if they named an obstacle, acknowledge it in their words.
NEXT: one concrete next step for the very next session.`;
}

function parseGuide(text, fallback = {}) {
  const src = String(text || '');
  const doingWell = cleanText((src.match(/DOING WELL:\s*([\s\S]*?)(?=\n\s*OBSTACLE:|\n\s*ASSESSMENT:)/) || [])[1] || '');
  const obstacle = cleanText((src.match(/OBSTACLE:\s*([\s\S]*?)(?=\n\s*TODAY'S FOCUS:|\n\s*ASSESSMENT:)/) || [])[1] || '');
  const todaysFocus = cleanText((src.match(/TODAY'S FOCUS:\s*([\s\S]*?)(?=\n\s*ASSESSMENT:|\n\s*NEXT:)/) || [])[1] || '');
  const assessment = cleanText((src.match(/ASSESSMENT:\s*([\s\S]*?)(?=\n\s*NEXT:)/) || [])[1] || '');
  const nextStep = cleanText((src.match(/NEXT:\s*([\s\S]*?)$/) || [])[1] || '');
  const out = Object.assign({}, fallback, { assessment, nextStep });
  if (doingWell) out.doingWell = doingWell;
  if (obstacle) { out.obstacle = obstacle; out.blockers = obstacle; }
  if (todaysFocus) { out.todaysFocus = todaysFocus; out.nextAction = todaysFocus; }
  return out;
}

/** LLM path with deterministic fallback. */
async function guideAsync(ctx) {
  const det = guide(ctx);
  if (!llm.available()) return det;
  try {
    const text = await llm.callLLM(
      buildGuidePrompt(ctx),
      [{ type: 'text', text: 'Guide me on this goal now.' }],
      { maxTokens: 550 }
    );
    const parsed = parseGuide(text, det);
    if (parsed.assessment && parsed.nextStep) return parsed;
  } catch (e) { /* fall through to the deterministic guide */ }
  return det;
}

module.exports = {
  isPropFirmGoal,
  inferGoalMetric,
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
