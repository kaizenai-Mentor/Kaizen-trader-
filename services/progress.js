/**
 * Progress service — My Progress computations (spec §2.8), pure functions.
 *
 * Region A of the page: the private progress picture, computed from
 * ScoreSnapshots (the V2 record) and Journal sessions. Deterministic,
 * testable, no DB, no clock (dates injected).
 *
 * Honesty rules carried: practice consistency is never presented as
 * trading performance; Building states are shown, never guessed.
 */

const SESSION_MILESTONES = [5, 10, 25, 50, 100, 250, 500];

const DIMENSIONS = ['process', 'risk', 'execution', 'behavior', 'learning'];

/** Timeline points from snapshots (chronological). Non-null overalls only. */
function timeline(snapshots) {
  return (snapshots || [])
    .filter(s => s && s.overall !== null && s.overall !== undefined)
    .map(s => ({
      t: s.computedAt || s.createdAt || null,
      v: Math.round(s.overall),
      state: s.overallState || 'READY'
    }));
}

/**
 * Movement vs ~N days ago: latest snapshot compared with the newest
 * snapshot that is older than the window (else the earliest snapshot).
 * Returns { overall, dimensions: {key: {now, then, delta}} } — null scores
 * stay null (Building), never guessed.
 */
function movement(snapshots, days = 30, now = new Date()) {
  const usable = (snapshots || []).filter(s => s && s.overall != null);
  if (!usable.length) return null;

  const latest = usable[usable.length - 1];
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const past = usable
    .filter(s => new Date(s.computedAt || s.createdAt || 0) <= cutoff)
    .pop() || usable[0];

  const dim = (snap) => {
    const out = {};
    for (const k of DIMENSIONS) {
      const d = snap.dimensions && snap.dimensions[k];
      out[k] = d && d.score != null ? Math.round(d.score) : null;
    }
    return out;
  };

  const nowDims = dim(latest);
  const thenDims = dim(past);
  const dimensions = {};
  for (const k of DIMENSIONS) {
    dimensions[k] = {
      now: nowDims[k],
      then: thenDims[k],
      delta: (nowDims[k] != null && thenDims[k] != null) ? nowDims[k] - thenDims[k] : null
    };
  }

  return {
    overall: {
      now: Math.round(latest.overall),
      then: Math.round(past.overall),
      delta: Math.round(latest.overall) - Math.round(past.overall),
      same: latest === past
    },
    dimensions,
    comparedAt: past.computedAt || past.createdAt || null
  };
}

/**
 * Practice vs performance: per session-type stats + the flagship insight.
 * LIVE = performance under real risk; BACKTEST/STUDY = practice.
 * The gap between them is the coachable pattern.
 */
function typePerformance(sessions) {
  const types = { LIVE: { count: 0, compliant: 0 }, BACKTEST: { count: 0, compliant: 0 }, STUDY: { count: 0, compliant: 0 } };
  for (const s of sessions || []) {
    const t = types[s.sessionType || 'LIVE'] || types.LIVE;
    t.count += 1;
    if (s.ruleCompliance) t.compliant += 1;
  }
  for (const t of Object.values(types)) t.rate = t.count ? Math.round((t.compliant / t.count) * 100) : null;

  let insight = null;
  const { LIVE, BACKTEST } = types;
  if (LIVE.count >= 3 && BACKTEST.count >= 3 &&
      BACKTEST.rate !== null && LIVE.rate !== null) {
    const gap = BACKTEST.rate - LIVE.rate;
    if (gap >= 10) {
      insight = {
        kind: 'gap',
        message: `Your BACKTEST discipline is ${gap} points above your LIVE discipline. The gap is the work — the rules are in you; the risk isn't.`
      };
    } else if (gap <= -10) {
      insight = {
        kind: 'inverse',
        message: `Your LIVE discipline is ${-gap} points above your BACKTEST discipline. You sharpen up when it's real — practice deserves the same respect.`
      };
    } else {
      insight = {
        kind: 'even',
        message: 'Your practice discipline and your live discipline are within reach of each other. That consistency is rare — protect it.'
      };
    }
  }
  return { types, insight };
}

/** Next session milestone (shared with the Cockpit). */
function nextSessionMilestone(totalSessions) {
  const next = SESSION_MILESTONES.find(m => m > totalSessions);
  if (!next) {
    return { label: `${SESSION_MILESTONES[SESSION_MILESTONES.length - 1]}+ sessions — legend territory`, progress: 100, remaining: 0 };
  }
  return {
    label: `${next} sessions logged`,
    progress: Math.round((totalSessions / next) * 100),
    remaining: next - totalSessions
  };
}

/** SVG polyline points for the score sparkline (viewBox 0 0 w h). */
function sparklinePoints(points, w = 300, h = 64) {
  const pts = points || [];
  if (pts.length === 0) return '';
  if (pts.length === 1) return `${(w / 2).toFixed(1)},${(h - (pts[0].v / 100) * h).toFixed(1)}`;
  return pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - (p.v / 100) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

module.exports = {
  SESSION_MILESTONES,
  DIMENSIONS,
  timeline,
  movement,
  typePerformance,
  nextSessionMilestone,
  sparklinePoints
};
