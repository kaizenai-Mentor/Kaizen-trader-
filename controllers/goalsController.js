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
    const ctx = await loadContext(userId(req));
    const goals = await Goal.find({ userId: userId(req) }).sort({ status: 1, createdAt: -1 }).lean();
    const suggestions = goalCoach.suggest(ctx);
    res.render('goals', {
      user: req.session.user,
      goals,
      suggestions,
      metrics: METRICS
    });
  } catch (err) {
    console.error('goals list:', err.message);
    res.redirect('/dashboard');
  }
}

async function postCreate(req, res) {
  try {
    const metric = METRICS.includes(req.body.metric) ? req.body.metric : 'CUSTOM';
    const target = req.body.target === '' || req.body.target == null ? null : Number(req.body.target);
    await Goal.create({
      userId: userId(req),
      title: String(req.body.title || 'Untitled goal').slice(0, 140),
      metric,
      target: Number.isFinite(target) ? target : null,
      unit: String(req.body.unit || '').slice(0, 12),
      cadence: req.body.cadence === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY',
      rationale: String(req.body.rationale || '').slice(0, 500)
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

async function postLog(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/goals');
    const value = req.body.value === '' || req.body.value == null ? null : Number(req.body.value);
    await Goal.updateOne(
      { _id: req.params.id, userId: userId(req) },
      {
        $push: {
          progressLog: {
            at: new Date(),
            value: Number.isFinite(value) ? value : null,
            note: String(req.body.note || '').slice(0, 300)
          }
        }
      }
    );
    res.redirect('/goals/' + req.params.id);
  } catch (err) {
    console.error('goal log:', err.message);
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

async function postAdapt(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/goals');
    const goal = await Goal.findOne({ _id: req.params.id, userId: userId(req) });
    if (!goal) return res.redirect('/goals');
    const target = req.body.target === '' || req.body.target == null ? null : Number(req.body.target);
    if (Number.isFinite(target)) goal.target = target;
    const ctx = await loadContext(userId(req));
    const guidance = await goalCoach.guideAsync(Object.assign({ goal: goal.toObject() }, ctx));
    goal.guidance = (guidance.assessment || '') + '\n\nNEXT: ' + (guidance.nextStep || '');
    goal.guidanceAt = new Date();
    await goal.save();
    res.redirect('/goals/' + req.params.id);
  } catch (err) {
    console.error('goal adapt:', err.message);
    res.redirect('/goals');
  }
}

module.exports = { getList, postCreate, getDetail, postLog, postStatus, postAdapt };
