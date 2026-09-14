/**
 * My Progress controller (spec §2.8).
 *
 * Region A — the private progress picture: score timeline from
 * ScoreSnapshots, dimension movement, practice-vs-performance,
 * milestones. Region B — the community ranking, carried from V1
 * with honesty labels (verification ≠ skill; V1 scores frozen at
 * cutover until V2 histories build).
 */
const User = require('../models/User');
const Journal = require('../models/Journal');
const ScoreSnapshot = require('../models/ScoreSnapshot');
const progress = require('../services/progress');

async function getProgress(req, res) {
  try {
    const userId = req.session.user.id;

    const [user, snapshotsAsc, sessions] = await Promise.all([
      User.findById(userId),
      ScoreSnapshot.find({ userId }).sort({ computedAt: 1 }).limit(200).lean(),
      Journal.find({ userId }).sort({ createdAt: -1 }).limit(500).lean()
    ]);

    const points = progress.timeline(snapshotsAsc);
    const move = progress.movement(snapshotsAsc, 30);
    const typePerf = progress.typePerformance(sessions);
    const totalSessions = sessions.length;
    const nextMilestone = progress.nextSessionMilestone(totalSessions);

    // Region B — community, carried from V1 (frozen scores, honest labels)
    const allTimeLeaders = await User.find({})
      .sort({ disciplineScore: -1 })
      .limit(20)
      .select('username disciplineScore totalSessions streak');
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyLeaders = await User.find({ updatedAt: { $gte: weekAgo } })
      .sort({ disciplineScore: -1 })
      .limit(20)
      .select('username disciplineScore totalSessions streak');

    res.render('leaderboard', {
      user: req.session.user,
      fullUser: user,
      points,
      move,
      typePerf,
      totalSessions,
      nextMilestone,
      sparkPoints: progress.sparklinePoints(points, 300, 64),
      dimensionLabels: {
        process: 'Process', risk: 'Risk', execution: 'Execution',
        behavior: 'Behavior', learning: 'Learning & Consistency'
      },
      streak: (user && user.streak) || 0,
      badges: (user && user.badges) || [],
      allTimeLeaders,
      weeklyLeaders,
      title: 'My Progress'
    });
  } catch (error) {
    console.error('My Progress error:', error.message);
    res.redirect('/dashboard');
  }
}

module.exports = { getProgress };
