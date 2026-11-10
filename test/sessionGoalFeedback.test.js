const test = require('node:test');
const assert = require('node:assert/strict');
const { feedbackForSession, syncGoalsFromSession } = require('../services/sessionGoalFeedback');
const { feedbackDueToday } = require('../services/goalCoach');

const now = new Date('2026-10-16T12:00:00Z');
const session = {
  _id: 'session1', state: 'RECORDED', sessionType: 'LIVE', createdAt: now,
  asset: 'XAUUSD', plan: { setup: 'London sweep' }, notes: 'I waited before the buy.',
  reportedChecks: { followedPlan: 'YES', respectedRisk: 'NOT_MENTIONED' },
  quickChecks: { respectedRisk: 'YES' }
};

function fakeModel(goals) {
  return {
    async find(query) { return goals.filter(g => g.userId === query.userId && g.status === query.status); },
    async updateOne(filter, update) {
      const g = goals.find(g => g._id === filter._id && g.userId === filter.userId && g.status === filter.status);
      if (!g) return { matchedCount: 0, modifiedCount: 0 };
      const match = filter.progressLog.$elemMatch || filter.progressLog.$not.$elemMatch;
      const index = g.progressLog.findIndex(e => Object.entries(match).every(([k, v]) => e[k] === v));
      if (filter.progressLog.$elemMatch) {
        if (index < 0) return { matchedCount: 0, modifiedCount: 0 };
        for (const [k, v] of Object.entries(update.$set)) g.progressLog[index][k.replace('progressLog.$.', '')] = v;
      } else {
        if (index >= 0) return { matchedCount: 0, modifiedCount: 0 };
        g.progressLog.push({ ...update.$push.progressLog });
      }
      return { matchedCount: 1, modifiedCount: 1 };
    }
  };
}

test('only relevant reported evidence is used; inferred or missing risk is not a pass', () => {
  assert.equal(feedbackForSession({ metric: 'RISK_LIMIT' }, session, [session], now), null);
  assert.equal(feedbackForSession({ metric: 'CUSTOM' }, session, [session], now), null);
  assert.equal(feedbackForSession({ metric: 'RULE_COMPLIANCE' }, { ...session, sessionType: 'STUDY' }, [session], now), null);
  const rule = feedbackForSession({ metric: 'RULE_COMPLIANCE' }, session, [session], now);
  assert.match(rule.note, /followed plan yes/);
  assert.match(rule.note, /I waited before the buy\./);
  assert.equal(rule.compliant, null); // a partial check is not a claim of full compliance
  assert.equal(rule.value, null);
  const risk = feedbackForSession({ metric: 'RISK_LIMIT' }, { ...session, reportedChecks: { respectedRisk: 'NO' } }, [session], now);
  assert.match(risk.note, /did not respect risk/);
  assert.equal(risk.compliant, false);
  const mentioned = feedbackForSession({ metric: 'RISK_LIMIT' }, { ...session, notes: 'I reduced my risk.', reportedChecks: {} }, [session], now);
  assert.match(mentioned.note, /no risk-check verdict recorded/);
  assert.equal(mentioned.compliant, null);
});

test('record, reflect and retry update one entry; manual and other users remain untouched', async () => {
  const goals = [
    { _id: 'g1', userId: 'u1', status: 'ACTIVE', metric: 'RULE_COMPLIANCE', progressLog: [{ source: 'MANUAL', note: 'rest day' }] },
    { _id: 'g2', userId: 'u1', status: 'ACTIVE', metric: 'RISK_LIMIT', progressLog: [] },
    { _id: 'g3', userId: 'u1', status: 'PAUSED', metric: 'RULE_COMPLIANCE', progressLog: [] },
    { _id: 'g4', userId: 'u2', status: 'ACTIVE', metric: 'RULE_COMPLIANCE', progressLog: [] }
  ];
  const GoalModel = fakeModel(goals);
  const sync = s => syncGoalsFromSession({ GoalModel, userId: 'u1', session: s, history: [s], now });
  await sync(session);
  assert.equal(goals[0].progressLog.length, 2);
  assert.equal(feedbackDueToday(goals[0], now), false);
  assert.equal(goals[1].progressLog.length, 0);
  const reflected = { ...session, state: 'REFLECTED', reflection: { learned: 'Wait for the close' } };
  await Promise.all([sync(reflected), sync(reflected), sync(session)]);
  await sync(session); // delayed record must not overwrite reflection
  assert.equal(goals[0].progressLog.length, 2);
  assert.equal(goals[0].progressLog[0].note, 'rest day');
  assert.match(goals[0].progressLog[1].note, /Wait for the close/);
  assert.equal(goals[0].progressLog[1].phase, 'REFLECTED');
  assert.equal(goals[2].progressLog.length, 0);
  assert.equal(goals[3].progressLog.length, 0);
});

test('session and journal goals accept study sessions; planned sessions cannot sync', async () => {
  const study = { ...session, sessionType: 'STUDY' };
  assert.equal(feedbackForSession({ metric: 'SESSIONS_PER_WEEK' }, study, [study], now).value, 1);
  assert.equal(feedbackForSession({ metric: 'JOURNAL_STREAK' }, study, [study], now).value, 1);
  assert.equal(feedbackForSession({ metric: 'JOURNAL_STREAK' }, { ...study, state: 'PLANNED' }, [study], now), null);
});
