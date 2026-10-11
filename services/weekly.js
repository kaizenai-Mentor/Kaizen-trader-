/**
 * Weekly report computations (spec §4.2) — pure functions, no DB, no clock.
 *
 * "Your week in one honest page": sessions by type, loop completion,
 * quick-check compliance, and the honest empty state. Score movement
 * reuses services/progress.js movement() with a 7-day window.
 */

const DIMENSIONS = ['process', 'risk', 'execution', 'behavior', 'learning'];

/**
 * Stats for the sessions inside a rolling week window.
 * Honest by design: states are counted, never judged; compliance is a
 * rate of sessions that stayed inside their rules — practice consistency,
 * never trading performance.
 */
function weekStats(sessions) {
  const byType = { LIVE: 0, BACKTEST: 0, STUDY: 0 };
  const states = { PLANNED: 0, RECORDED: 0, REFLECTED: 0, ANALYZED: 0 };
  let compliant = 0;
  let checked = 0;

  for (const s of sessions || []) {
    byType[s.sessionType || 'LIVE'] = (byType[s.sessionType || 'LIVE'] || 0) + 1;
    if (states[s.state] !== undefined) states[s.state] += 1;
    if (s.ruleCompliance === true) compliant += 1;
    if (s.ruleCompliance === true || s.ruleCompliance === false) checked += 1;
  }

  const total = sessions ? sessions.length : 0;
  return {
    total,
    byType,
    states,
    compliant,
    checked,
    complianceRate: checked ? Math.round((compliant / checked) * 100) : null,
    loopCompleted: states.ANALYZED,
    loopOpen: states.PLANNED + states.RECORDED + states.REFLECTED
  };
}

/**
 * Badges earned inside the window (milestone movement this week).
 */
function badgesThisWeek(badges, weekStart) {
  return (badges || []).filter(b => b.earnedAt && new Date(b.earnedAt) >= weekStart);
}

/** The honest letter for a week with zero sessions — no API call needed. */
const EMPTY_WEEK_LETTER = 'No sessions this week. The record notices — without judging.\n\nA week without a session is information too: life happened, the market gave nothing worth taking, or the habit slipped. Only you know which one it was — and only the next session decides what it means.\n\nWhen you come back, start with a plan. Even one.';

module.exports = { DIMENSIONS, weekStats, badgesThisWeek, EMPTY_WEEK_LETTER };
