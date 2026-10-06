/**
 * Weekly Report controller (spec §4.2) — "your week in one honest page".
 *
 * Rewired for V2: score movement from ScoreSnapshots (deltas, never
 * recomputed ad-hoc), sessions by type + loop completion, milestone
 * movement, streak, and the coach's letter (aiCoach weekly variant,
 * MindState-aware, cached per week+session-count in Memories so repeat
 * visits don't re-bill the API).
 */
const User = require('../models/User');
const Journal = require('../models/Journal');
const ScoreSnapshot = require('../models/ScoreSnapshot');
const TradingSystem = require('../models/TradingSystem');
const MindState = require('../models/MindState');
const Memory = require('../models/Memory');
const progress = require('../services/progress');
const weekly = require('../services/weekly');
const aiCoach = require('../services/aiCoach');

async function getWeekly(req, res) {
  try {
    const userId = req.session.user.id;
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [user, snapshotsAsc, weekSessions, mindState] = await Promise.all([
      User.findById(userId),
      ScoreSnapshot.find({ userId }).sort({ computedAt: 1 }).limit(200).lean(),
      Journal.find({ userId, createdAt: { $gte: weekStart } }).sort({ createdAt: -1 }).lean(),
      MindState.ensureForUser(userId)
    ]);
    const system = await TradingSystem.ensureForUser(user);

    const stats = weekly.weekStats(weekSessions);
    const move = progress.movement(snapshotsAsc, 7, now);
    const earned = weekly.badgesThisWeek(user.badges, weekStart);

    // The coach's letter — honest empty state, or cached/generated letter.
    let letter;
    let letterCached = false;
    if (stats.total === 0) {
      letter = weekly.EMPTY_WEEK_LETTER;
      letterCached = true; // deterministic — nothing to bill
    } else {
      const cacheKey = `weekOf|${weekStart.toISOString().slice(0, 10)}|sessions|${stats.total}`;
      const cached = await Memory.findOne({
        userId, asset: 'Weekly Report', sessionData: cacheKey
      }).sort({ createdAt: -1 }).lean();
      if (cached) {
        letter = cached.response;
        letterCached = true;
      } else {
        letter = await aiCoach.writeWeeklyLetter({
          user, system, weekSessions, movement: move, mindState
        });
        try {
          await Memory.create({
            userId, type: 'journal', asset: 'Weekly Report',
            sessionData: cacheKey, response: letter, sessionScore: stats.total
          });
        } catch (memErr) {
          console.error('Weekly letter archive error:', memErr.message);
        }
      }
    }

    res.render('weekly-summary', {
      user: req.session.user,
      stats,
      move,
      letter,
      letterCached,
      earned,
      streak: user.streak || 0,
      weekStart,
      dimensionLabels: {
        process: 'Process', risk: 'Risk', execution: 'Execution',
        behavior: 'Behavior', learning: 'Learning & Consistency'
      },
      title: 'Weekly Report'
    });
  } catch (error) {
    console.error('Weekly report error:', error.message);
    res.redirect('/dashboard');
  }
}

module.exports = { getWeekly };
