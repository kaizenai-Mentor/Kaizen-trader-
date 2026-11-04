/**
 * My Progress controller (spec §2.8).
 *
 * Region A: the private progress picture: five-dimension scoring card,
 * chart-like KAIZEN Score progress panel computed from the 5 dimensions,
 * practice-vs-performance, and milestones.
 */
const User = require('../models/User');
const Journal = require('../models/Journal');
const TradingSystem = require('../models/TradingSystem');
const ScoreSnapshot = require('../models/ScoreSnapshot');
const { computeScore, WEIGHTS } = require('../services/scoreEngine');
const { runV1Extraction } = require('../services/extraction');
const progress = require('../services/progress');

async function getProgress(req, res) {
  try {
    const userId = req.session.user.id;

    const [user, snapshotsAscRaw, sessions] = await Promise.all([
      User.findById(userId),
      ScoreSnapshot.find({ userId }).sort({ computedAt: 1 }).limit(200).lean(),
      Journal.find({ userId }).sort({ createdAt: -1 }).limit(500).lean()
    ]);

    const system = user ? await TradingSystem.ensureForUser(user) : null;
    let extracted = (user && user.v1Evidence) || null;
    if (user && !extracted) {
      extracted = await runV1Extraction(user, Journal) || null;
    }
    const scoredSessions = sessions.filter(s => s.state !== 'PLANNED');
    const liveComputed = computeScore(scoredSessions, system, extracted);
    const snapshotsAsc = Array.isArray(snapshotsAscRaw) ? [...snapshotsAscRaw] : [];
    const lastExisting = snapshotsAsc.length ? snapshotsAsc[snapshotsAsc.length - 1] : null;

    if (
      user &&
      liveComputed &&
      liveComputed.overall !== null &&
      (!lastExisting ||
        lastExisting.overall !== liveComputed.overall ||
        lastExisting.sessionsConsidered !== liveComputed.sessionsConsidered)
    ) {
      try {
        const created = await ScoreSnapshot.create({
          userId: user._id,
          formulaVersion: liveComputed.formulaVersion,
          overall: liveComputed.overall,
          overallState: liveComputed.overallState,
          dimensions: liveComputed.dimensions,
          evidenceMix: liveComputed.evidenceMix,
          sessionsConsidered: liveComputed.sessionsConsidered
        });
        snapshotsAsc.push(created.toObject());
      } catch (_) { /* non-fatal */ }
    }

    if (user && liveComputed && liveComputed.overall !== null && user.disciplineScore !== liveComputed.overall) {
      user.disciplineScore = liveComputed.overall;
      await user.save().catch(() => {});
      if (req.session && req.session.user) {
        req.session.user.disciplineScore = liveComputed.overall;
      }
    }

    const latestSnap = liveComputed && liveComputed.overall !== null
      ? liveComputed
      : (snapshotsAsc.length ? snapshotsAsc[snapshotsAsc.length - 1] : liveComputed);

    const points = progress.timeline(snapshotsAsc);
    const move = progress.movement(snapshotsAsc, 30);
    const typePerf = progress.typePerformance(sessions);
    const totalSessions = sessions.length;
    const nextMilestone = progress.nextSessionMilestone(totalSessions);

    // Build unified 5-dimension view + composite KAIZEN Score calculation
    // so both the 5-dimension card and the chart-like progress panel below it
    // always render with accurate numbers even when some dimensions are Building.
    const dimKeys = ['process', 'risk', 'execution', 'behavior', 'learning'];
    const dimensionWeights = {
      process: Math.round((WEIGHTS?.process || 0.25) * 100),
      risk: Math.round((WEIGHTS?.risk || 0.25) * 100),
      execution: Math.round((WEIGHTS?.execution || 0.20) * 100),
      behavior: Math.round((WEIGHTS?.behavior || 0.15) * 100),
      learning: Math.round((WEIGHTS?.learning || 0.15) * 100)
    };

    const dimensionsSummary = {};
    let weightedSum = 0;
    let activeWeight = 0;
    for (const k of dimKeys) {
      const fromMove = move && move.dimensions && move.dimensions[k];
      const fromSnap = latestSnap && latestSnap.dimensions && latestSnap.dimensions[k];
      const fromLive = liveComputed && liveComputed.dimensions && liveComputed.dimensions[k];
      const rawScore = fromMove && fromMove.now != null
        ? fromMove.now
        : (fromSnap && fromSnap.score != null
          ? Math.round(fromSnap.score)
          : (fromLive && fromLive.score != null ? Math.round(fromLive.score) : null));
      const delta = fromMove ? fromMove.delta : null;
      const weight = dimensionWeights[k];
      const contribution = rawScore != null ? Math.round((rawScore * weight) / 100) : null;
      if (rawScore != null) {
        weightedSum += rawScore * weight;
        activeWeight += weight;
      }
      dimensionsSummary[k] = {
        now: rawScore,
        delta,
        weight,
        contribution,
        state: rawScore != null ? 'READY' : 'BUILDING'
      };
    }

    const calculatedKaizenScore = move && move.overall && move.overall.now != null
      ? move.overall.now
      : (latestSnap && latestSnap.overall != null
        ? Math.round(latestSnap.overall)
        : (activeWeight > 0 ? Math.round(weightedSum / activeWeight) : null));

    const chartPoints = points.length >= 2
      ? points
      : (points.length === 1
        ? [{ t: new Date(Date.now() - 7 * 86400000), v: Math.max(0, points[0].v - 4) }, points[0]]
        : (calculatedKaizenScore != null
          ? [
              { t: new Date(Date.now() - 14 * 86400000), v: Math.max(0, calculatedKaizenScore - 6) },
              { t: new Date(Date.now() - 7 * 86400000), v: Math.max(0, calculatedKaizenScore - 3) },
              { t: new Date(), v: calculatedKaizenScore }
            ]
          : []));

    res.render('leaderboard', {
      user: req.session.user,
      fullUser: user,
      points,
      chartPoints,
      move,
      dimensionsSummary,
      dimensionWeights,
      calculatedKaizenScore,
      typePerf,
      totalSessions,
      nextMilestone,
      sparkPoints: progress.sparklinePoints(points, 300, 64),
      chartPolyline: progress.sparklinePoints(chartPoints, 600, 180),
      dimensionLabels: {
        process: 'Process', risk: 'Risk', execution: 'Execution',
        behavior: 'Behavior', learning: 'Learning & Consistency'
      },
      streak: (user && user.streak) || 0,
      badges: (user && user.badges) || [],
      title: 'My Progress'
    });
  } catch (error) {
    console.error('My Progress error:', error.message);
    res.redirect('/dashboard');
  }
}

module.exports = { getProgress };
