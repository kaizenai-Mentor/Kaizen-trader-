/**
 * Improvement Recommendations controller (owner directive 19 Oct 2026).
 *
 * GET /improve — the AI improvement surface: actionable suggestions
 * from the trader's own patterns, mistakes and performance. English
 * only; deterministic fallback when no provider key is set.
 */
const User = require('../models/User');
const Journal = require('../models/Journal');
const ScoreSnapshot = require('../models/ScoreSnapshot');
const TradingSystem = require('../models/TradingSystem');
const MindState = require('../models/MindState');
const progress = require('../services/progress');
const improveCoach = require('../services/improveCoach');

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

async function getIndex(req, res) {
  try {
    const { user, sessions, system, movement, mindState } =
      await loadContext(req.session.user.id || req.session.user._id);
    const rec = await improveCoach.recommend({ user, system, sessions, movement, mindState });
    res.render('improve', {
      user: req.session.user,
      rec,
      movement,
      totalSessions: sessions.length
    });
  } catch (err) {
    console.error('improve page:', err.message);
    res.redirect('/dashboard');
  }
}

module.exports = { getIndex, loadContext };
