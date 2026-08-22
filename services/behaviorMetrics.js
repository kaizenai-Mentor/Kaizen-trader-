/**
 * KAIZEN deterministic behavior metrics — Phase 1B.
 *
 * These are computed ONLY from confirmed on-chain activity (timing, cadence,
 * protocol usage). No AI is involved here and no composite "score" is
 * invented: each metric is a transparent, reproducible number with its
 * evidence window attached. AI may later *explain* these numbers; it never
 * generates them.
 *
 * Verification level for these metrics: L2 — Wallet activity verified.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @param {Array} activities BlockchainActivity docs, sorted occurredAt ascending.
 * @param {object} opts { windowDays?: number } — rolling observation window.
 */
function computeMetrics(activities, { windowDays = 30 } = {}) {
  const now = Date.now();
  const windowStart = now - windowDays * DAY_MS;

  const inWindow = activities.filter(a => {
    const t = new Date(a.occurredAt).getTime();
    return t >= windowStart && t <= now;
  });

  const totalTx = inWindow.length;

  // Active days & cadence
  const dayKeys = new Set(inWindow.map(a => Math.floor(new Date(a.occurredAt).getTime() / DAY_MS)));
  const activeDays = dayKeys.size;

  // Gaps between consecutive transactions (trading frequency signal)
  const times = inWindow.map(a => new Date(a.occurredAt).getTime()).sort((a, b) => a - b);
  const gapsHours = [];
  for (let i = 1; i < times.length; i++) {
    gapsHours.push((times[i] - times[i - 1]) / (60 * 60 * 1000));
  }
  const medianGapHours = median(gapsHours);

  // Busiest day (overtrading signal, deterministic threshold)
  const perDay = new Map();
  for (const key of dayKeys) perDay.set(key, 0);
  for (const a of inWindow) {
    const key = Math.floor(new Date(a.occurredAt).getTime() / DAY_MS);
    perDay.set(key, (perDay.get(key) || 0) + 1);
  }
  const maxTxInOneDay = Math.max(0, ...perDay.values());
  const heavyDays = [...perDay.values()].filter(n => n >= 10).length;

  // Protocol diversity & usage mix
  const protocolMix = {};
  const actionMix = {};
  for (const a of inWindow) {
    const p = a.protocolName || 'Other';
    protocolMix[p] = (protocolMix[p] || 0) + 1;
    actionMix[a.action || 'other'] = (actionMix[a.action || 'other'] || 0) + 1;
  }

  // DeFi engagement: share of txs that hit a recognized protocol
  const recognized = inWindow.filter(a => a.protocolKey).length;
  const defiEngagementPct = totalTx ? Math.round((recognized / totalTx) * 100) : 0;

  // Regularity: distinct active days vs elapsed days in window
  const elapsedDays = Math.min(
    windowDays,
    totalTx ? Math.max(1, Math.ceil((now - times[0]) / DAY_MS)) : 0
  );
  const consistencyPct = elapsedDays ? Math.round((activeDays / elapsedDays) * 100) : 0;

  return {
    verificationLevel: 'L2 — wallet activity verified',
    windowDays,
    generatedAt: new Date().toISOString(),
    totals: {
      transactions: totalTx,
      activeDays,
      firstActivity: times.length ? new Date(times[0]).toISOString() : null,
      lastActivity: times.length ? new Date(times[times.length - 1]).toISOString() : null
    },
    cadence: {
      medianGapHours: medianGapHours === null ? null : Math.round(medianGapHours * 10) / 10,
      maxTxInOneDay,
      heavyTradingDays: heavyDays, // days with >= 10 txs
      heavyTradingFlag: heavyDays > 0
    },
    engagement: {
      protocolMix,
      actionMix,
      protocolsUsed: Object.keys(protocolMix).length,
      defiEngagementPct
    },
    consistency: {
      activeDaysPct: Math.min(100, consistencyPct)
    }
  };
}

module.exports = { computeMetrics, median };
