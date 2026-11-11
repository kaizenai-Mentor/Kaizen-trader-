/** Session-sourced goal check-ins. Manual feedback remains a separate entry. */
const Goal = require('../models/Goal');
const Journal = require('../models/Journal');
const { sessionsThisWeek, journalStreak } = require('./goalCoach');

const hasAnswer = v => v === 'YES' || v === 'NO';
const excerpt = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);

function feedbackForSession(goal, session, history, now) {
  if (!goal || !session || !session._id || session.state === 'PLANNED') return null;
  const checks = session.reportedChecks || {};
  const liveChecks = session.sessionType !== 'STUDY';
  const reflection = session.reflection || {};
  const journalText = [session.notes, reflection.whatHappened, reflection.followedProcess, reflection.learned, reflection.wouldChange].filter(Boolean).join(' ');
  const ruleMention = /\b(plan|rules?|checklist|discipline|entry criteria|entry condition)\b/i.test(journalText);
  const riskMention = /\b(risk|drawdown|stop[ -]?loss|position siz(?:e|ing)|lot size|sizing)\b/i.test(journalText);
  let evidence;
  let value = null;
  let compliant = null;
  switch (goal.metric) {
    case 'RULE_COMPLIANCE': {
      const answers = ['followedPlan', 'withinEntryCriteria', 'respectedRisk']
        .filter(key => hasAnswer(checks[key]));
      if (liveChecks && answers.length) {
        const labels = { followedPlan: 'followed plan', withinEntryCriteria: 'within entry criteria', respectedRisk: 'respected risk' };
        evidence = 'Reported checks: ' + answers.map(key => `${labels[key]} ${checks[key] === 'YES' ? 'yes' : 'no'}`).join(', ') + '.';
        compliant = answers.some(key => checks[key] === 'NO') ? false : null;
      } else if (ruleMention) {
        evidence = 'Journal mentions rules or planning; no rule-check verdict recorded.';
      } else return null;
      break;
    }
    case 'RISK_LIMIT':
    case 'PROP_FIRM':
      if (liveChecks && hasAnswer(checks.respectedRisk)) {
        evidence = `Reported risk check: ${checks.respectedRisk === 'YES' ? 'respected risk' : 'did not respect risk'}.`;
        compliant = checks.respectedRisk === 'YES';
      } else if (riskMention) {
        evidence = 'Journal mentions risk; no risk-check verdict recorded.';
      } else return null;
      break;
    case 'SESSIONS_PER_WEEK':
      evidence = 'Session recorded.';
      value = sessionsThisWeek(history, now);
      break;
    case 'JOURNAL_STREAK':
      evidence = 'Session journal recorded.';
      value = journalStreak(history, now);
      break;
    default:
      // A custom goal has no reliable automatic matching rule.
      return null;
  }
  const asset = excerpt(session.asset, 100);
  const setup = excerpt(session.plan && session.plan.setup, 140);
  const pieces = [evidence];
  const notes = excerpt(session.notes, 300);
  if (notes) pieces.push(`Journal: “${notes}”`);
  const happened = excerpt(reflection.whatHappened, 100);
  const process = excerpt(reflection.followedProcess, 100);
  const learned = excerpt(reflection.learned, 120);
  const change = excerpt(reflection.wouldChange, 120);
  if (happened) pieces.push(`Reflection: “${happened}”`);
  if (process) pieces.push(`Process: “${process}”`);
  if (learned) pieces.push(`Takeaway: “${learned}”`);
  if (change) pieces.push(`Next adjustment: “${change}”`);
  return {
    at: now, value, note: pieces.join(' ').slice(0, 800), source: 'SESSION',
    sessionId: session._id, asset, setup, compliant,
    phase: session.state === 'RECORDED' ? 'RECORDED' : 'REFLECTED'
  };
}

/**
 * Atomic per-goal updates prevent concurrent record/reflect requests from
 * duplicating a check-in or overwriting a reflection with older record data.
 */
async function syncGoalsFromSession({ GoalModel, userId, session, history, now = new Date() }) {
  if (!GoalModel || !userId || !session || !session._id || session.state === 'PLANNED') return 0;
  const goals = await GoalModel.find({ userId, status: 'ACTIVE' });
  let count = 0;
  for (const goal of goals) {
    const entry = feedbackForSession(goal, session, history || [session], now);
    if (!entry) continue;
    const match = { sessionId: session._id, source: 'SESSION' };
    if (entry.phase === 'RECORDED') match.phase = 'RECORDED';
    const filter = { _id: goal._id, userId, status: 'ACTIVE', progressLog: { $elemMatch: match } };
    const fields = {};
    for (const key of ['at', 'value', 'note', 'asset', 'setup', 'compliant', 'phase']) fields['progressLog.$.' + key] = entry[key];
    const update = { $set: fields };
    let result = await GoalModel.updateOne(filter, update);
    if (!result.matchedCount) {
      result = await GoalModel.updateOne({
        _id: goal._id, userId, status: 'ACTIVE',
        progressLog: { $not: { $elemMatch: { sessionId: session._id, source: 'SESSION' } } }
      }, { $push: { progressLog: entry } });
      if (!result.modifiedCount) result = await GoalModel.updateOne(filter, update);
    }
    count += result.modifiedCount || 0;
  }
  return count;
}

async function syncSessionFeedback(userId, session) {
  const history = await Journal.find({ userId, state: { $ne: 'PLANNED' } })
    .select('createdAt').sort({ createdAt: -1 }).limit(400).lean();
  return syncGoalsFromSession({ GoalModel: Goal, userId, session, history });
}

module.exports = { feedbackForSession, syncGoalsFromSession, syncSessionFeedback };
