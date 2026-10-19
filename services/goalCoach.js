/**
 * services/goalCoach.js — Goal Guidance (owner directive 19 Oct 2026):
 * AI assistance for setting, tracking and adapting trading improvement
 * goals over time.
 *
 * Same contract as the other coaches:
 * - English only. Personal — their numbers, their rule text, their words.
 * - Goals are behaviour targets, never profit targets. No market
 *   predictions, ever.
 * - Deterministic fallback without a provider key: the guidance is
 *   computed from the record itself, so tracking always works.
 * - One rule at a time: next steps are doable in the very next session.
 */
const llm = require('./llm');

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
const PROP_FIRM_RE = /\b(prop\s*firm|propfirm|evaluation|challenge|funded|funding|ftmo|the5ers|myforex|e8\s*markets|surge|trueforex|audacity|alpha\s*capital|funded\s*trader|get\s*funded)\b/i;

function isPropFirmGoal(goal) {
  if (!goal) return false;
  if (goal.metric === 'PROP_FIRM') return true;
  return PROP_FIRM_RE.test(String(goal.title || '') + ' ' + String(goal.rationale || ''));
}

function metricLabel(m) {
  return METRIC_LABELS[m] || METRIC_LABELS.CUSTOM;
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
 * Propose goals from the record. Deterministic, personal.
 * Test pins: "one rule at a time", rationale cites their numbers.
 */
function suggest({ user, system, sessions, movement, mindState } = {}) {
  const recent = lastSessions(sessions, 10);
  const comp = complianceRate(recent);
  const week = sessionsThisWeek(sessions);
  const theme = mindState && (mindState.themes || [])
    .find(t => t.status === 'active' || t.status === 'improving');
  const rule = (system && (system.entryRules || system.rules) || []).toString().split('\n')[0] || '';

  const out = [];

  if (!recent.length) {
    out.push({
      title: 'Log one full loop — plan, record, reflect',
      metric: 'SESSIONS_PER_WEEK',
      target: 1,
      unit: 'sessions',
      cadence: 'WEEKLY',
      rationale: 'Nothing has been recorded yet. One complete loop this week is the whole goal — the record starts keeping score after that.'
    });
    return out;
  }

  if (comp.value == null || comp.value < 80) {
    out.push({
      title: comp.value == null ? 'Answer the rule question on every session' : 'Keep 8 of your last 10 sessions inside your rules',
      metric: 'RULE_COMPLIANCE',
      target: 80,
      unit: '%',
      cadence: 'WEEKLY',
      rationale: comp.value == null
        ? 'Your sessions are not being measured against the rule question yet — a goal needs a number, and this is the one your engine scores.'
        : `${comp.kept} of your last ${comp.checked} recorded sessions stayed inside your rules (${comp.value}%). One rule at a time: your entry rule — "${rule || 'the rule you write down before the session'}" — is the one to protect.`
    });
  } else {
    out.push({
      title: 'Hold 9 of 10 inside your rules',
      metric: 'RULE_COMPLIANCE',
      target: 90,
      unit: '%',
      cadence: 'WEEKLY',
      rationale: `${comp.value}% of your recent sessions stayed inside your rules — the discipline is holding. Tighten the standard slowly instead of chasing wins.`
    });
  }

  if (week < 3) {
    out.push({
      title: 'Run the loop on 3 sessions this week',
      metric: 'SESSIONS_PER_WEEK',
      target: 3,
      unit: 'sessions',
      cadence: 'WEEKLY',
      rationale: `You logged ${week} session${week === 1 ? '' : 's'} in the last seven days. The loop compounds when it runs — three honest sessions beat ten rushed ones.`
    });
  }

  if (theme) {
    out.push({
      title: `Trade 5 sessions without a single ${String(theme.name).toLowerCase()} act`,
      metric: 'CUSTOM',
      target: 5,
      unit: 'sessions',
      cadence: 'WEEKLY',
      rationale: `Your Psychology room is still on "${theme.name}" (${theme.status}). The goal is not to feel different — it is to act differently five sessions running.`
    });
  }

  return out.slice(0, 3);
}

/**
 * Guidance for one goal: track it against the record and say how to
 * adapt. Deterministic and personal. Test pins: gap language with
 * their numbers, "one rule at a time".
 */
function guide({ goal, user, system, sessions, movement, mindState, now = new Date() } = {}) {
  if (!goal) return { assessment: 'No goal yet.', nextStep: 'Set one small goal — one rule at a time.' };

  const recent = lastSessions(sessions, 10);
  const current = currentValue(goal, sessions, now);
  const comp = complianceRate(recent);
  const target = goal.target;

  let assessment;
  let nextStep;

  if (isPropFirmGoal(goal)) {
    // Discipline and accountability only — the boundary is the product.
    const riskNow = currentValue({ metric: 'PROP_FIRM' }, sessions, now);
    const compNow = complianceRate(recent);
    if (riskNow == null) {
      assessment = `"${goal.title}" is an evaluation goal — and evaluations are passed by discipline, not by ideas: the daily loss limit, the max drawdown, and your own written rules. The record needs sessions with the risk question answered before the tracking is honest.`;
      nextStep = 'Log your next session with the risk question answered — inside the limit or not, say so. Accountability starts with one honest entry. One rule at a time.';
    } else {
      assessment = `"${goal.title}" — funded accounts are earned by staying inside the limits when it hurts: the daily loss limit, the max drawdown, and your own written rules. Your recent record: ${riskNow}% of your checked sessions held those limits${compNow.checked ? ` — ${compNow.kept} of your last ${compNow.checked} stayed inside your rules overall` : ''}. I coach the discipline and accountability your evaluation measures — never what to trade.`;
      nextStep = goal.metric === 'PROP_FIRM' && goal.target != null && riskNow >= goal.target
        ? `You are meeting this goal. Hold the standard: pre-set the daily loss limit before the next session and end the day when it hits — that habit is what funding desks actually evaluate. One rule at a time.`
        : 'In the next session, the job is not profit — it is finishing inside the daily loss limit and your entry rule. Write the plan first, log it either way. One rule at a time.';
    }
    return { assessment, nextStep };
  }

  if (current == null || target == null) {
    assessment = `"${goal.title}" has no readable number yet — the record needs sessions measured against it before guidance can be honest.`;
    nextStep = 'Log the next session with the rule question answered, and the tracking starts itself. One rule at a time.';
  } else {
    const gap = Math.round((target - current) * 10) / 10;
    if (gap > 0) {
      assessment = `You are at ${current}${goal.unit || ''} on "${goal.title}" — ${gap}${goal.unit || ''} short of the ${target}${goal.unit || ''} target.${comp.checked ? ` Behind the number: ${comp.kept} of your last ${comp.checked} recorded sessions stayed inside your rules.` : ''}`;
      nextStep = goal.metric === 'RULE_COMPLIANCE' && comp.checked
        ? `In the next session, protect exactly one rule — the one written as your entry rule — and log the session either way. One rule at a time closes this gap.`
        : `Choose the smallest step that moves this number once — in the very next session, not the next month. One rule at a time.`;
    } else if (goal.status === 'ACHIEVED') {
      assessment = `"${goal.title}" is marked achieved at ${current}${goal.unit || ''}. The behaviour held — that is the win worth keeping.`;
      nextStep = 'Keep the same standard for two more weeks before you raise the bar. Steady beats stretched.';
    } else {
      assessment = `You are at ${current}${goal.unit || ''} against a ${target}${goal.unit || ''} target on "${goal.title}" — the goal is being met.`;
      nextStep = 'Hold this standard. If it holds for two more weeks, tighten the target by one step — never by two.';
    }
  }

  return { assessment, nextStep };
}

/** System prompt for the LLM path of goal guidance (structure pins). */
function buildGuidePrompt({ goal, user, system, sessions, movement, mindState }) {
  return `You are KAIZEN, the goal coach inside a trader's improvement journal. English only.

VOICE: second person, their numbers and their words, warm and honest. Goals are behaviour targets — never profit targets. No market predictions, no trading insights, no signals, no market opinions — for prop-firm goals KAIZEN coaches ONLY the discipline and accountability the evaluation measures (daily loss limit, max drawdown, consistency, the trader's own written rules). One rule at a time: the next step must be doable in the very next session.

GOAL: ${goal.title} (metric: ${goal.metric}, target: ${goal.target}${goal.unit || ''}, cadence: ${goal.cadence}, status: ${goal.status})
RECENT SESSIONS:
${lastSessions(sessions, 10).map(s => `- [${s.sessionType || 'LIVE'}] rules:${s.ruleCompliance === false ? 'BROKEN' : 'kept'} :: ${(s.notes || '').slice(0, 100)}`).join('\n') || 'None yet.'}

Write exactly this shape:

ASSESSMENT: one short paragraph tracking the goal against the record.
NEXT: one concrete next step for the very next session.`;
}

function parseGuide(text) {
  const src = String(text || '');
  const assessment = (src.match(/ASSESSMENT:\s*([\s\S]*?)(?=\n\s*NEXT:)/) || [])[1]?.trim() || '';
  const nextStep = (src.match(/NEXT:\s*([\s\S]*?)$/) || [])[1]?.trim() || '';
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
  suggest,
  guide,
  guideAsync,
  buildGuidePrompt,
  parseGuide,
  currentValue,
  complianceRate,
  sessionsThisWeek,
  journalStreak
};
