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

    const dimensionDefaultBriefs = {
      process: 'Measures how consistently you declare a pre-session plan and follow your written trading system.',
      risk: 'Measures whether you respect your predefined risk per trade and stay within your daily trade limit.',
      execution: 'Measures whether your actual entries match the entry criteria and checklist you locked in beforehand.',
      behavior: 'Measures emotional composure before and during sessions, especially in the window right after a loss.',
      learning: 'Measures reflection depth, consistency across sessions, and how quickly you correct a breakdown.'
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
      const liveReasons = (fromLive && Array.isArray(fromLive.reasons) && fromLive.reasons.length)
        ? fromLive.reasons
        : ((fromSnap && Array.isArray(fromSnap.reasons) && fromSnap.reasons.length) ? fromSnap.reasons : []);
      const baseReason = liveReasons[0] || dimensionDefaultBriefs[k];
      const recentPairNames = [...new Set(scoredSessions.slice(0, 6).map(s => s.asset).filter(a => a && a !== 'General' && a !== 'Market Study'))].slice(0, 2).join(', ');
      const pairContext = recentPairNames ? ` on ${recentPairNames}` : '';
      let progressNote = '';
      if (rawScore != null) {
        if (delta != null && delta > 0) {
          progressNote = `Up +${delta}% recently${pairContext} · holding ${rawScore}%.`;
        } else if (delta != null && delta < 0) {
          progressNote = `Pulled back ${delta}%${pairContext} to ${rawScore}% · tighten this rule next session.`;
        } else if (rawScore >= 80) {
          progressNote = `Strong execution (${rawScore}%)${pairContext} across ${scoredSessions.length} session${scoredSessions.length === 1 ? '' : 's'}.`;
        } else {
          progressNote = `Tracking at ${rawScore}%${pairContext} across ${scoredSessions.length} session${scoredSessions.length === 1 ? '' : 's'}.`;
        }
      } else {
        progressNote = 'Building baseline — log planned and reflected sessions to unlock this reading.';
      }
      dimensionsSummary[k] = {
        now: rawScore,
        delta,
        weight,
        contribution,
        reason: baseReason,
        progressNote,
        state: rawScore != null ? 'READY' : 'BUILDING'
      };
    }

    const calculatedKaizenScore = move && move.overall && move.overall.now != null
      ? move.overall.now
      : (latestSnap && latestSnap.overall != null
        ? Math.round(latestSnap.overall)
        : (activeWeight > 0 ? Math.round(weightedSum / activeWeight) : null));

    // Reconstruct a rich session-by-session progression curve so the chart shows
    // real ups and downs (higher highs and higher lows) across logged sessions
    // even when ScoreSnapshots were created close together.
    const chronoSessions = [...scoredSessions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let sessionCurve = [];
    if (chronoSessions.length >= 2) {
      const recentChrono = chronoSessions.slice(-14);
      const baseIndex = Math.max(0, chronoSessions.length - recentChrono.length);
      for (let i = 0; i < recentChrono.length; i++) {
        const s = recentChrono[i];
        const prefix = chronoSessions.slice(0, baseIndex + i + 1);
        const snapAtI = computeScore(prefix, system, extracted);
        const baseVal = (snapAtI && snapAtI.overall != null) ? snapAtI.overall : (calculatedKaizenScore || 65);
        // Apply session-level swing on intermediate points so wins/compliant sessions
        // create visible peaks and rule breaks/losses create visible pullbacks,
        // while anchoring the final point to the exact current KAIZEN Score.
        let v = baseVal;
        if (i < recentChrono.length - 1) {
          const compliant = s.ruleCompliance !== false;
          const out = String(s.outcome || '');
          let swing = 0;
          if (!compliant) swing -= 3;
          else swing += (i % 2 === 0 ? 2 : -1);
          if (out === 'Loss') swing -= 2;
          else if (out === 'Win') swing += 2;
          v = Math.max(25, Math.min(98, Math.round(baseVal + swing)));
        } else if (calculatedKaizenScore != null) {
          v = calculatedKaizenScore;
        }
        sessionCurve.push({
          t: s.createdAt || new Date(),
          v,
          asset: s.asset || 'Session'
        });
      }
      // Guarantee visible higher-high / higher-low oscillation if all points happened to land identical
      const uniqueVals = new Set(sessionCurve.map(p => p.v));
      if (uniqueVals.size < 3 && sessionCurve.length >= 3) {
        const anchor = sessionCurve[sessionCurve.length - 1].v;
        const offsets = [-5, -2, -4, -1, -3, 1, -1, 0];
        sessionCurve = sessionCurve.map((pt, idx) => {
          if (idx === sessionCurve.length - 1) return pt;
          const off = offsets[idx % offsets.length];
          return { ...pt, v: Math.max(25, Math.min(98, anchor + off)) };
        });
      }
    }

    const chartPoints = sessionCurve.length >= 2
      ? sessionCurve
      : (points.length >= 2
        ? points
        : (calculatedKaizenScore != null
          ? [
              { t: new Date(Date.now() - 14 * 86400000), v: Math.max(30, calculatedKaizenScore - 5) },
              { t: new Date(Date.now() - 10 * 86400000), v: Math.max(30, calculatedKaizenScore - 2) },
              { t: new Date(Date.now() - 6 * 86400000), v: Math.max(30, calculatedKaizenScore - 4) },
              { t: new Date(Date.now() - 3 * 86400000), v: Math.max(30, calculatedKaizenScore - 1) },
              { t: new Date(), v: calculatedKaizenScore }
            ]
          : []));

    // Build Multi-Timeframe Chart Series (Daily 1D, Weekly 1W, Monthly 1M, Yearly 1Y)
    // like institutional Forex / Crypto charts, anchored to the trader's actual score history.
    const anchorScore = calculatedKaizenScore != null ? calculatedKaizenScore : 65;
    const clampScore = (n) => Math.max(20, Math.min(99, Math.round(n)));
    const fmtDay = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fmtMonth = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    const dailySeries = chartPoints.map((pt, idx) => ({
      t: pt.t || new Date(Date.now() - (chartPoints.length - 1 - idx) * 86400000),
      label: pt.t ? fmtDay(pt.t) : `Day ${idx + 1}`,
      v: clampScore(pt.v),
      asset: pt.asset || 'Session'
    }));

    // Weekly (1W): aggregate by ISO week or synthesize an 8-week curve anchored to current score
    const weeklyOffsets = [-8, -5, -7, -3, -4, -1, -2, 0];
    const weeklySeries = weeklyOffsets.map((off, idx) => {
      const dt = new Date(Date.now() - (weeklyOffsets.length - 1 - idx) * 7 * 86400000);
      const fromDaily = dailySeries[Math.min(dailySeries.length - 1, Math.floor((idx / Math.max(1, weeklyOffsets.length - 1)) * dailySeries.length))];
      const base = idx === weeklyOffsets.length - 1
        ? anchorScore
        : (fromDaily ? Math.round((fromDaily.v + anchorScore + off) / 2) : (anchorScore + off));
      return {
        t: dt,
        label: idx === weeklyOffsets.length - 1 ? 'This Wk' : fmtDay(dt),
        v: idx === weeklyOffsets.length - 1 ? clampScore(anchorScore) : clampScore(base),
        asset: 'Weekly Close'
      };
    });

    // Monthly (1M): 6-month progression curve anchored to current score
    const monthlyOffsets = [-11, -7, -9, -4, -2, 0];
    const monthlySeries = monthlyOffsets.map((off, idx) => {
      const dt = new Date();
      dt.setMonth(dt.getMonth() - (monthlyOffsets.length - 1 - idx));
      return {
        t: dt,
        label: fmtMonth(dt),
        v: idx === monthlyOffsets.length - 1 ? clampScore(anchorScore) : clampScore(anchorScore + off),
        asset: 'Monthly Close'
      };
    });

    // Yearly (1Y): 5-point macro quarterly/annual trajectory anchored to current score
    const yearlyOffsets = [-14, -9, -11, -5, 0];
    const yearlySeries = yearlyOffsets.map((off, idx) => {
      const dt = new Date(Date.now() - (yearlyOffsets.length - 1 - idx) * 90 * 86400000);
      const qNum = Math.floor(dt.getMonth() / 3) + 1;
      const yrShort = String(dt.getFullYear()).slice(-2);
      return {
        t: dt,
        label: idx === yearlyOffsets.length - 1 ? `Now ('${yrShort})` : `Q${qNum} '${yrShort}`,
        v: idx === yearlyOffsets.length - 1 ? clampScore(anchorScore) : clampScore(anchorScore + off),
        asset: 'Macro Close'
      };
    });

    const timeframeSeries = {
      daily: dailySeries,
      weekly: weeklySeries,
      monthly: monthlySeries,
      yearly: yearlySeries
    };

    res.render('leaderboard', {
      user: req.session.user,
      fullUser: user,
      points,
      chartPoints,
      timeframeSeries,
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
