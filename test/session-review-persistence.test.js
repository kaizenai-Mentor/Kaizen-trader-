const test = require('node:test');
const assert = require('node:assert/strict');
const Journal = require('../models/Journal');
const User = require('../models/User');
const TradingSystem = require('../models/TradingSystem');
const Snapshot = require('../models/ScoreSnapshot');
const MindState = require('../models/MindState');
const Goal = require('../models/Goal');
const coach = require('../services/aiCoach');
const scoring = require('../services/scoreEngine');
const feedback = require('../services/sessionGoalFeedback');

// Stub database and unrelated scoring work, while exercising the actual
// postReflect streaming controller, its tail holdback, and its save path.
scoring.computeScore = () => ({ overall: null, dimensions: {}, sessionsConsidered: 0 });
feedback.syncSessionFeedback = async () => {};
const controller = require('../controllers/sessionsController');
User.findById = async () => ({ _id: 'user', v1Evidence: {}, save: async () => {} });
TradingSystem.ensureForUser = async () => ({});
Journal.find = () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [] });
Snapshot.create = async () => ({});
Snapshot.findOne = () => ({ sort: async () => null });
MindState.ensureForUser = async () => null;
Goal.find = () => ({ lean: async () => [] });

async function run(streamImpl) {
  const session = {
    _id: 'session', state: 'RECORDED', sessionType: 'LIVE', outcome: 'Pending',
    notes: '', quickChecks: {}, toObject() { return { ...this }; },
    save: async function () {}
  };
  Journal.findOne = async () => session;
  coach.streamAnalysis = streamImpl;
  const events = [];
  const res = {
    writeHead() {}, flushHeaders() {},
    write(text) { events.push(JSON.parse(text.slice(6))); },
    end() {}
  };
  await controller.postReflect({ params: { id: 'session' }, session: { user: { id: 'user' } }, body: { stream: '1' }, headers: {} }, res);
  return { session, events };
}

test('reset discards failed response and extraction before saving replacement', async () => {
  const { session, events } = await run(async function* ({ onReset }) {
    yield 'Failed provider partial EXTRACTED: outcome=Loss rr=1 pips=20';
    onReset({ retrying: true });
    yield 'Successful provider review EXTRACTED: outcome=Win rr=2 pips=10';
  });
  assert.equal(session.state, 'ANALYZED');
  assert.equal(session.aiAnalysis, 'Successful provider review');
  assert.equal(session.outcome, 'Win');
  assert.equal(session.rrAchieved, '2');
  assert.equal(events.filter(e => e.type === 'reset').length, 1);
  assert.ok(events.findIndex(e => e.type === 'reset') < events.findIndex(e => e.type === 'delta' && e.text.includes('Successful')));
  assert.equal(events.at(-1).type, 'done');
});

test('all-provider failure saves and displays only labeled fallback', async () => {
  const { session, events } = await run(async function* ({ onReset }) {
    yield 'Incomplete provider response that is long enough to appear';
    onReset({ retrying: false });
    throw new Error('failed');
  });
  assert.match(session.aiAnalysis, /limited automated response/i);
  assert.doesNotMatch(session.aiAnalysis, /Incomplete provider response/);
  const resetIndex = events.findIndex(e => e.type === 'reset');
  assert.equal(events[resetIndex].retrying, false);
  assert.match(events.slice(resetIndex + 1).find(e => e.type === 'delta').text, /limited automated response/i);
});
