/**
 * services/labels.js — friendly English labels for stored enum values.
 *
 * The record keeps machine codes (PLANNED, LIVE, first_session, …); the
 * screens show words a trader reads. English-only site, so the maps are
 * plain English. Unknown values fall back to a humanised version of the
 * raw code, never an error.
 */

const SESSION_STATE = {
  PLANNED: 'Planned',
  RECORDED: 'Recorded',
  REFLECTED: 'Reflected',
  ANALYZED: 'Analyzed'
};

const SESSION_TYPE = {
  LIVE: 'Live',
  BACKTEST: 'Backtest',
  STUDY: 'Study'
};

const OUTCOME = {
  Win: 'Win',
  Loss: 'Loss',
  Breakeven: 'Breakeven',
  'No Trade': 'No trade',
  Pending: 'Pending'
};

const MIND_STATUS = {
  active: 'Active',
  improving: 'Improving',
  resolved: 'Resolved'
};

const BADGES = {
  first_session: 'First Session',
  streak_5: 'Five-Day Streak',
  streak_10: 'Ten-Day Streak',
  streak_30: 'Thirty-Day Streak',
  sessions_10: 'Ten Sessions Logged',
  sessions_25: 'Twenty-Five Sessions Logged',
  sessions_50: 'Fifty Sessions Logged',
  sessions_100: 'Hundred Sessions Logged',
  rule_keeper: 'Rule Keeper',
  risk_discipline: 'Risk Discipline',
  honest_journal: 'Honest Journal'
};

function humanise(code) {
  return String(code == null ? '' : code)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function state(v) { return SESSION_STATE[v] || humanise(v); }
function type(v) { return SESSION_TYPE[v] || humanise(v); }
function outcome(v) { return OUTCOME[v] || humanise(v); }
function mindStatus(v) { return MIND_STATUS[v] || humanise(v); }
function badge(v) { return BADGES[v] || humanise(v); }

module.exports = { SESSION_STATE, SESSION_TYPE, OUTCOME, MIND_STATUS, BADGES, state, type, outcome, mindStatus, badge, humanise };
