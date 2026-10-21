/**
 * Weekly Review controller (spec §4.2, extended 20 Oct 2026) —
 * "your week in one honest page" PLUS the improvement proposals:
 * the old Improve page merged in (owner directive), so the week's
 * numbers and what to work on live together.
 *
 * Rewired for V2: score movement from ScoreSnapshots (deltas, never
 * recomputed ad-hoc), sessions by type + loop completion, milestone
 * movement, streak, the coach's letter (aiCoach weekly variant,
 * MindState-aware, cached per week+session-count in Memories so repeat
 * visits don't re-bill the API) — and improveCoach's proposals built
 * from the same context.
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
const improveCoach = require('../services/improveCoach');

async function getWeekly(req, res) {
  try {
    const userId = req.session.user.id;
    const now = new Date();
    // Owner directive (20 Oct 2026): a week runs SUNDAY → SATURDAY.
    // weekStart is this week's Sunday 00:00; weekEnd is next Sunday
    // (exclusive), so the window is exactly Sun–Sat.
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const [user, snapshotsAsc, weekSessions, mindState, allSessions] = await Promise.all([
      User.findById(userId),
      ScoreSnapshot.find({ userId }).sort({ computedAt: 1 }).limit(200).lean(),
      Journal.find({ userId, createdAt: { $gte: weekStart, $lt: weekEnd } }).sort({ createdAt: -1 }).lean(),
      MindState.ensureForUser(userId),
      Journal.find({ userId }).sort({ createdAt: 1 }).limit(60).lean()
    ]);
    const system = await TradingSystem.ensureForUser(user);

    const stats = weekly.weekStats(weekSessions);
    const move = progress.movement(snapshotsAsc, 7, now);
    const earned = weekly.badgesThisWeek(user.badges, weekStart);

    // Visible dates on every card (owner directive 20 Oct 2026) —
    // always the calendar week: Sunday through Saturday.
    const weekSat = new Date(weekStart);
    weekSat.setDate(weekStart.getDate() + 6);
    const fShort = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fFull = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dateRange = weekStart.getFullYear() === weekSat.getFullYear()
      ? `${fShort(weekStart)} – ${fFull(weekSat)}`
      : `${fFull(weekStart)} – ${fFull(weekSat)}`;

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

    // The proposals (the old Improve page): same record, same coach.
    let rec;
    try {
      rec = await improveCoach.recommend({
        user, system, sessions: allSessions,
        movement: progress.movement(snapshotsAsc, 30),
        mindState
      });
    } catch (recErr) {
      console.error('Weekly proposals error:', recErr.message);
      rec = null;
    }

    res.render('weekly-summary', {
      user: req.session.user,
      stats,
      move,
      letter,
      letterCached,
      earned,
      rec,
      themes: (mindState && mindState.themes) || [],
      dateRange,
      streak: user.streak || 0,
      weekStart,
      dimensionLabels: {
        process: 'Process', risk: 'Risk', execution: 'Execution',
        behavior: 'Behavior', learning: 'Learning & Consistency'
      },
      title: 'Weekly Review'
    });
  } catch (error) {
    console.error('Weekly report error:', error.message);
    res.redirect('/dashboard');
  }
}

module.exports = { getWeekly };
