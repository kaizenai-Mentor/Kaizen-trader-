/**
 * Goal Guidance controller (owner directive 19 Oct 2026).
 *
 * /goals — set, track and adapt behaviour goals with the coach.
 * English only; guidance is computed from the trader's own record
 * (LLM when a provider key is set, deterministic otherwise).
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Journal = require('../models/Journal');
const ScoreSnapshot = require('../models/ScoreSnapshot');
const TradingSystem = require('../models/TradingSystem');
const MindState = require('../models/MindState');
const Goal = require('../models/Goal');
const progress = require('../services/progress');
const goalCoach = require('../services/goalCoach');

const METRICS = ['RULE_COMPLIANCE', 'SESSIONS_PER_WEEK', 'RISK_LIMIT', 'JOURNAL_STREAK', 'PROP_FIRM', 'CUSTOM'];
const STATUSES = ['ACTIVE', 'PAUSED', 'ACHIEVED', 'ARCHIVED'];

async function loadContext(userId) {
  const [user, sessions, snapshots, mindState] = await Promise.all([
    User.findById(userId),
    Journal.find({ userId }).sort({ createdAt: 1 }).limit(60).lean(),
    ScoreSnapshot.find({ userId }).sort({ createdAt: 1 }).lean(),
    MindState.ensureForUser(userId)
  ]);
  const system = user ? await TradingSystem.ensureForUser(user) : null;
  const movement = progress.movement(snapshots, 30);
  return { user, sessions, system, movement, mindState };
}

function userId(req) {
  return req.session.user.id || req.session.user._id;
}

async function getList(req, res) {
  try {
    // Goals are the trader's own (owner directive 20 Oct 2026): KAIZEN
    // never proposes goals here — it only lists and guides what they set.
    const uid = userId(req);
    const [rawGoals, ctx] = await Promise.all([
      Goal.find({ userId: uid }).sort({ status: 1, createdAt: -1 }).lean(),
      loadContext(uid)
    ]);
    const goals = rawGoals.map(g => Object.assign(g, {
      dueToday: goalCoach.feedbackDueToday(g),
      current: goalCoach.currentValue(g, ctx.sessions),
      guidance: goalCoach.guide(Object.assign({ goal: g }, ctx))
    }));
    res.render('goals', {
      user: req.session.user,
      goals,
      metrics: METRICS
    });
  } catch (err) {
    console.error('goals list:', err.message);
    res.redirect('/dashboard');
  }
}

async function postCreate(req, res) {
  try {
    const title = String(req.body.title || 'Untitled goal').slice(0, 140);
    const rationale = String(req.body.rationale || '').slice(0, 500);
    const metric = METRICS.includes(req.body.metric)
      ? req.body.metric
      : goalCoach.inferGoalMetric(title, rationale);
    const target = req.body.target === '' || req.body.target == null ? null : Number(req.body.target);
    await Goal.create({
      userId: userId(req),
      title,
      metric,
      target: Number.isFinite(target) ? target : null,
      unit: String(req.body.unit || '').slice(0, 12),
      cadence: req.body.cadence === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY',
      rationale
    });
    res.redirect('/goals');
  } catch (err) {
    console.error('goal create:', err.message);
    res.redirect('/goals');
  }
}

async function getDetail(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/goals');
    const goal = await Goal.findOne({ _id: req.params.id, userId: userId(req) }).lean();
    if (!goal) return res.redirect('/goals');
    const ctx = await loadContext(userId(req));
    const guidance = await goalCoach.guideAsync(Object.assign({ goal }, ctx));
    const current = goalCoach.currentValue(goal, ctx.sessions);
    res.render('goal-detail', {
      user: req.session.user,
      goal,
      guidance,
      current,
      statuses: STATUSES
    });
  } catch (err) {
    console.error('goal detail:', err.message);
    res.redirect('/goals');
  }
}

/**
 * Daily feedback (owner directive 21 Oct 2026): the journaling-style
 * entry the reminder asks for every day. Text is the heart of it —
 * the coach gauges the process from these words; the value is optional
 * measurement alongside.
 */
async function postFeedback(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/goals');
    const value = req.body.value === '' || req.body.value == null ? null : Number(req.body.value);
    const note = String(req.body.note || '').trim().slice(0, 800);
    if (!note) return res.redirect('/goals/' + req.params.id);
    await Goal.updateOne(
      { _id: req.params.id, userId: userId(req) },
      {
        $push: {
          progressLog: {
            at: new Date(),
            value: Number.isFinite(value) ? value : null,
            note
          }
        }
      }
    );
    res.redirect('/goals/' + req.params.id);
  } catch (err) {
    console.error('goal feedback:', err.message);
    res.redirect('/goals');
  }
}

async function postStatus(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/goals');
    const status = STATUSES.includes(req.body.status) ? req.body.status : 'ACTIVE';
    await Goal.updateOne({ _id: req.params.id, userId: userId(req) }, { $set: { status } });
    res.redirect('/goals/' + req.params.id);
  } catch (err) {
    console.error('goal status:', err.message);
    res.redirect('/goals');
  }
}

module.exports = { getList, postCreate, getDetail, postFeedback, postStatus };
