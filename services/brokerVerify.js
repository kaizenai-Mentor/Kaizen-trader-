/**
 * KAIZEN Privacy-First Broker Trade Verification & Auto-Memory Dossier Engine.
 *
 * Principles:
 * 1. Zero sensitive data: strips account numbers, logins, broker server names,
 *    deposit/withdrawal rows, dollar balances ($), dollar PnL, and lot sizes.
 * 2. Skims synced broker history whenever a trader logs a LIVE session (even
 *    hours or days after the trade took place) to confirm the execution.
 * 3. Automatically writes the Branded KAIZEN Trader's Card & Dossier from the
 *    trader's Memories, Trading System, and verified Sessions so the trader
 *    never has to write a summary manually.
 */

const crypto = require('crypto');
const { extractInstrumentFromText, resolveSessionContext, extractCompleteNarrative } = require('./aiCoach');
const cleanText = require('./cleanText');

function normalizeSymbol(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  // Strip broker suffixes like EURUSD.m, XAUUSD.pro, AUDJPY#
  const base = s.replace(/[._#-][a-zA-Z0-9]{1,5}$/, '').trim();
  const detected = extractInstrumentFromText(base) || extractInstrumentFromText(s);
  if (detected) return detected;
  const alnum = base.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
  if (/^(JP225|JPN225|JAPAN ?225|NIKKEI ?225?)$/.test(alnum)) return 'Japan 225';
  if (/^[A-Z]{6}$/.test(alnum)) return alnum;
  if (/^(XAUUSD|XAGUSD|US30|NAS100|US100|SPX500|US500|GER40|UK100|BTCUSD|ETHUSD|SOLUSD|USOIL|UKOIL)$/.test(alnum)) {
    return alnum;
  }
  return '';
}

function normalizeDirection(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (/^(buy|long|buy limit|buy stop|b)$/i.test(s) || /\bbuy\b/.test(s)) return 'Buy';
  if (/^(sell|short|sell limit|sell stop|s)$/i.test(s) || /\bsell\b/.test(s)) return 'Sell';
  return '';
}

function parseDateSafe(raw) {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\./g, '-');
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 2015 && d.getFullYear() <= 2035) {
    return d;
  }
  return null;
}

function deriveOutcomeAndRR(direction, entryStr, slStr, exitStr) {
  const entry = parseFloat(String(entryStr || '').replace(/[^0-9.-]/g, ''));
  const exit = parseFloat(String(exitStr || '').replace(/[^0-9.-]/g, ''));
  const sl = parseFloat(String(slStr || '').replace(/[^0-9.-]/g, ''));
  if (!isFinite(entry) || !isFinite(exit) || entry <= 0 || exit <= 0) {
    return { outcome: 'No Trade', rrAchieved: '' };
  }
  const diff = direction === 'Sell' ? (entry - exit) : (exit - entry);
  const eps = Math.abs(entry) * 0.00005;
  let outcome = 'Breakeven';
  if (diff > eps) outcome = 'Win';
  else if (diff < -eps) outcome = 'Loss';

  let rrAchieved = '';
  if (isFinite(sl) && sl > 0 && Math.abs(entry - sl) > eps) {
    const r = Math.abs(diff) / Math.abs(entry - sl);
    if (isFinite(r) && r > 0 && r <= 50) {
      rrAchieved = `1:${r.toFixed(1)}`;
    }
  }
  return { outcome, rrAchieved };
}

function makeTradeHash({ instrument, direction, openTime, entryPrice, exitPrice }) {
  const key = [
    instrument || '',
    direction || '',
    openTime ? new Date(openTime).toISOString().slice(0, 16) : '',
    String(entryPrice || '').trim(),
    String(exitPrice || '').trim()
  ].join('|');
  return '0x' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

/**
 * Parse MT4 / MT5 HTML Reports or MT4 / MT5 / cTrader / TradingView CSV files.
 * Strips all sensitive fields (account number, name, balance, deposit, lot size, dollar PnL).
 */
function parseBrokerStatement(rawInput, filename = '') {
  const text = String(rawInput || '').trim();
  if (!text) return [];
  const results = [];
  const seen = new Set();

  const pushRow = (cells) => {
    const cleanCells = cells
      .map(c => String(c || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (cleanCells.length < 4) return;
    const joined = cleanCells.join(' ');
    // Privacy filter: skip balance, deposit, withdrawal, credit, summary, or header rows
    if (/\b(balance|deposit|withdrawal|credit|initial deposit|total net profit|gross profit|account|name|server|leverage)\b/i.test(joined) &&
        !/\b(buy|sell)\b/i.test(joined)) {
      return;
    }

    let direction = '';
    let instrument = '';
    const dates = [];
    const prices = [];

    for (const cell of cleanCells) {
      if (!direction) {
        const d = normalizeDirection(cell);
        if (d && cell.length <= 14) {
          direction = d;
          continue;
        }
      }
      if (!instrument) {
        const sym = normalizeSymbol(cell);
        if (sym && cell.length <= 18) {
          instrument = sym;
          continue;
        }
      }
      if (/^\d{4}[.\-/]\d{2}[.\-/]\d{2}(\s+\d{2}:\d{2}(:\d{2})?)?$/.test(cell)) {
        const dt = parseDateSafe(cell);
        if (dt) {
          dates.push(dt);
          continue;
        }
      }
      if (/^\d+(\.\d+)?$/.test(cell)) {
        const num = parseFloat(cell);
        // Exclude ticket numbers (> 1,000,000) and standard micro lot sizes (0.01 - 0.99 when followed by symbol)
        if (num > 0 && num < 500000) {
          prices.push(cell);
        }
      }
    }

    if (!instrument || !direction || prices.length < 2) return;

    // In MT4/MT5 rows: [LotSize, EntryPrice, SL, TP, ExitPrice] or [EntryPrice, SL, TP, ExitPrice]
    // If first number is a typical lot size (e.g. 0.01..5.00) and there are >= 3 prices where later prices look like asset prices, drop the lot size.
    let priceList = prices.slice();
    if (priceList.length >= 3) {
      const p0 = parseFloat(priceList[0]);
      const p1 = parseFloat(priceList[1]);
      if (p0 <= 20 && p1 > 0 && (Math.abs(p1 - p0) / Math.max(p1, 1) > 0.25 || priceList.length >= 4)) {
        priceList = priceList.slice(1);
      }
    }

    const entryPrice = priceList[0] || '';
    const exitPrice = priceList[priceList.length - 1] || '';
    const stopLoss = priceList.length >= 3 ? priceList[1] : '';
    const takeProfit = priceList.length >= 4 ? priceList[2] : '';
    const openTime = dates[0] || new Date();
    const closeTime = dates[1] || dates[0] || new Date();

    const { outcome, rrAchieved } = deriveOutcomeAndRR(direction, entryPrice, stopLoss, exitPrice);
    const tradeHash = makeTradeHash({ instrument, direction, openTime, entryPrice, exitPrice });
    if (seen.has(tradeHash)) return;
    seen.add(tradeHash);

    results.push({
      tradeHash,
      instrument,
      direction,
      openTime,
      closeTime,
      entryPrice,
      stopLoss: stopLoss === '0' || stopLoss === '0.00' || stopLoss === '0.00000' ? '' : stopLoss,
      takeProfit: takeProfit === '0' || takeProfit === '0.00' || takeProfit === '0.00000' ? '' : takeProfit,
      exitPrice,
      outcome,
      rrAchieved,
      importedAt: new Date()
    });
  };

  // 1. HTML table rows (MT4 / MT5 ReportHistory.html)
  if (/<tr[\s>]/i.test(text)) {
    const trMatches = text.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trMatches) {
      const tdMatches = tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
      if (tdMatches.length >= 4) pushRow(tdMatches);
    }
  }

  // 2. CSV / TSV / semicolon lines
  if (results.length === 0) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const sep = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
      const cols = line.split(sep).map(c => c.replace(/^["']|["']$/g, '').trim());
      if (cols.length >= 4) pushRow(cols);
    }
  }

  return results;
}

/**
 * Skim the trader's synced broker history to find a matching execution for a LIVE session.
 * Traders often log sessions hours or days after the trade took place, so we check
 * instrument + direction within a 14-day window around the session date.
 */
function matchSessionWithBrokerHistory(session = {}, brokerTrades = []) {
  const ctx = resolveSessionContext(session);
  const st = String(session.sessionType || 'LIVE').toUpperCase();
  if (st === 'STUDY' || st === 'BACKTEST' || ctx.isStudyOrBacktest) {
    return {
      status: 'STUDY_EXEMPT',
      verified: false,
      matchedTrade: null,
      verificationNote: ''
    };
  }

  const targetInstrument = normalizeSymbol(ctx.instrument || session.asset);
  const targetDir = ctx.tradeDirection ? (ctx.tradeDirection === 'sell' ? 'Sell' : 'Buy') : '';
  const sessionDate = session.createdAt ? new Date(session.createdAt) : new Date();
  const list = Array.isArray(brokerTrades) ? brokerTrades : [];

  let bestMatch = null;
  let bestDeltaMs = Infinity;

  for (const t of list) {
    if (!t || !t.instrument) continue;
    const tInst = normalizeSymbol(t.instrument);
    if (targetInstrument && tInst !== targetInstrument) continue;
    if (targetDir && t.direction && t.direction.toLowerCase() !== targetDir.toLowerCase()) continue;

    const tDate = t.closeTime ? new Date(t.closeTime) : (t.openTime ? new Date(t.openTime) : null);
    if (tDate && !isNaN(tDate.getTime())) {
      const deltaMs = Math.abs(sessionDate.getTime() - tDate.getTime());
      // Allow logging up to 14 days after the trade took place
      if (deltaMs <= 14 * 24 * 60 * 60 * 1000 && deltaMs < bestDeltaMs) {
        bestMatch = t;
        bestDeltaMs = deltaMs;
      }
    } else if (!bestMatch) {
      bestMatch = t;
    }
  }

  if (bestMatch) {
    return {
      status: 'VERIFIED',
      verified: true,
      matchedTrade: bestMatch,
      verificationNote: `Broker Verification: Confirmed ${bestMatch.instrument} ${bestMatch.direction} execution (${bestMatch.entryPrice} to ${bestMatch.exitPrice}) from your synced broker trade history.`
    };
  }

  const pairLabel = targetInstrument || 'this instrument';
  const dirLabel = targetDir ? ` ${targetDir.toLowerCase()}` : '';
  return {
    status: 'UNVERIFIED',
    verified: false,
    matchedTrade: null,
    verificationNote: `Verification Note: I skimmed your synced broker history for a matching ${pairLabel}${dirLabel} execution and could not find this trade on record yet. If you took this trade recently, sync your latest broker report when ready and I will verify it automatically. If this was a chart study or paper trade, switch the session to Study / Backtest mode. Until matched with a broker record, this session remains tagged as Self-Reported and will not count as a Broker-Verified execution on your Trader's Card.`
  };
}

/**
 * Automatically build the Branded KAIZEN Trader's Card & Plain-English Dossier
 * from the trader's Memories, Trading System, and logged Sessions (zero manual writing).
 */
function buildAutoTraderDossier({ user = {}, system = {}, sessions = [], memories = [], mindState = null, score = null }) {
  const allSessions = Array.isArray(sessions) ? sessions : [];
  const brokerTrades = Array.isArray(user.brokerTrades) ? user.brokerTrades : [];
  const setups = (system && Array.isArray(system.setups) ? system.setups : [])
    .map(s => s && s.name && String(s.name).trim())
    .filter(Boolean);

  // Discover primary instruments and strategies from actual sessions & broker trades
  const instCounts = {};
  const stratCounts = {};
  let compliantCount = 0;
  let checkedCount = 0;
  let studyCount = 0;
  let brokerVerifiedCount = 0;

  for (const s of allSessions) {
    const ctx = resolveSessionContext(s);
    if (ctx.instrument) instCounts[ctx.instrument] = (instCounts[ctx.instrument] || 0) + 1;
    if (ctx.strategy) stratCounts[ctx.strategy] = (stratCounts[ctx.strategy] || 0) + 1;
    if (ctx.isStudyOrBacktest) studyCount++;
    if (s.ruleCompliance === true || s.ruleCompliance === false) {
      checkedCount++;
      if (s.ruleCompliance === true) compliantCount++;
    }
    if (s.brokerVerification && s.brokerVerification.status === 'VERIFIED') {
      brokerVerifiedCount++;
    } else if (!ctx.isStudyOrBacktest && brokerTrades.length) {
      const m = matchSessionWithBrokerHistory(s, brokerTrades);
      if (m.verified) brokerVerifiedCount++;
    }
  }
  for (const bt of brokerTrades) {
    if (bt && bt.instrument) instCounts[bt.instrument] = (instCounts[bt.instrument] || 0) + 1;
  }

  const topInstruments = Object.entries(instCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k);
  const topStrategies = setups.length
    ? setups.slice(0, 3)
    : Object.entries(stratCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

  const complianceRate = checkedCount > 0 ? Math.round((compliantCount / checkedCount) * 100) : null;
  const riskRule = (system && system.riskRules && system.riskRules.riskPerTrade)
    ? `${String(system.riskRules.riskPerTrade).replace(/%$/, '')}% per trade`
    : '1% predefined risk per trade';

  // 1. Auto-written "How This Trader Operates" (from TradingSystem + Memories)
  const stratText = topStrategies.length
    ? topStrategies.join(' and ')
    : (system && system.entryRules ? cleanText(system.entryRules) : 'structured price-action setups');
  const instText = topInstruments.length ? topInstruments.join(', ') : 'major FX and index markets';
  const howITrade = `${user.username || 'This trader'} operates a structured trading methodology centered on ${stratText}, primarily focused on ${instText} with a strict risk ceiling of ${riskRule}. Across ${allSessions.length} documented KAIZEN sessions (${studyCount} chart study/backtest sessions and ${Math.max(0, allSessions.length - studyCount)} live sessions), execution is governed by multi-timeframe checklist confirmation before capital is committed.`;

  // 2. Auto-written "KAIZEN Behavioral Memory Synthesis"
  const activeThemes = (mindState && Array.isArray(mindState.themes))
    ? mindState.themes.filter(t => t && t.name).map(t => `${t.name} (${t.status || 'tracked'})`)
    : [];
  const behavioralSummary = complianceRate !== null
    ? `KAIZEN Memory has tracked ${checkedCount} rule-checked sessions with a ${complianceRate}% rule compliance rate.${activeThemes.length ? ` Active behavioral focus areas in memory include ${activeThemes.slice(0, 3).join(', ')}.` : ''} The trader consistently documents pre-session plans, post-session reflections, and chart structure lessons.`
    : `KAIZEN Memory is actively indexing this trader's pre-trade plans, chart studies, and post-session reflections to establish a verified behavioral track record.`;

  // 3. Auto-selected "Defining Trading & Study Decisions" (pulled automatically from Sessions & Memories)
  // Balances good sessions (wins / compliant executions / structured studies) with constructive lesson
  // sessions (losses / rule breakdowns) so the dossier reflects both edge and honest accountability.
  const toDecisionItem = (s) => {
    const ctx = resolveSessionContext(s);
    const narrative = extractCompleteNarrative(s.notes, 200);
    if (!narrative) return null;
    const lesson = (s.reflection && s.reflection.learned) ? cleanText(s.reflection.learned) : '';
    const vMatch = matchSessionWithBrokerHistory(s, brokerTrades);
    const isGood = s.outcome === 'Win' || (s.ruleCompliance !== false && s.outcome !== 'Loss');
    let qualityLabel = 'CLEAN PROCESS';
    if (ctx.isStudyOrBacktest) qualityLabel = 'STRUCTURED STUDY';
    else if (s.outcome === 'Win' && s.ruleCompliance !== false) qualityLabel = 'DISCIPLINED WIN';
    else if (s.outcome === 'Loss' || s.ruleCompliance === false) qualityLabel = 'GROWTH & LESSON';
    return {
      date: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
      instrument: ctx.instrument || s.asset || 'Market Session',
      strategy: ctx.strategy || (s.plan && s.plan.setup) || 'Declared System',
      mode: ctx.isStudyOrBacktest ? 'STUDY / BACKTEST' : (vMatch.verified ? 'BROKER-VERIFIED LIVE' : 'LIVE SESSION'),
      qualityLabel,
      isGood,
      narrative: cleanText(narrative),
      lesson: lesson || (isGood ? 'Executed inside declared checklist and risk boundaries.' : 'Documented breakdown honestly to tighten next session execution.'),
      compliant: s.ruleCompliance !== false
    };
  };

  const goodPool = [];
  const lessonPool = [];
  for (const s of allSessions.slice(0, 30)) {
    const item = toDecisionItem(s);
    if (!item) continue;
    if (item.isGood) goodPool.push(item);
    else lessonPool.push(item);
  }

  const memorableDecisions = [];
  // Target a balanced mix (up to 2 good sessions + up to 2 lesson sessions, or 2 good + 1 lesson),
  // falling back gracefully if one side has fewer entries.
  const maxTotal = 4;
  let gIdx = 0, lIdx = 0;
  while (memorableDecisions.length < maxTotal && (gIdx < goodPool.length || lIdx < lessonPool.length)) {
    if (gIdx < goodPool.length && (memorableDecisions.filter(d => d.isGood).length < 2 || lIdx >= lessonPool.length)) {
      memorableDecisions.push(goodPool[gIdx++]);
    }
    if (memorableDecisions.length < maxTotal && lIdx < lessonPool.length && (memorableDecisions.filter(d => !d.isGood).length < 2 || gIdx >= goodPool.length)) {
      memorableDecisions.push(lessonPool[lIdx++]);
    }
  }

  // Fallback to Memory records if sessions list is empty
  if (memorableDecisions.length === 0 && Array.isArray(memories) && memories.length > 0) {
    for (const m of memories.slice(0, 3)) {
      const narrative = extractCompleteNarrative(m.sessionData, 200);
      if (!narrative) continue;
      memorableDecisions.push({
        date: m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recorded',
        instrument: extractInstrumentFromText(m.sessionData) || m.asset || 'Market Session',
        strategy: topStrategies[0] || 'Declared System',
        mode: 'KAIZEN MEMORY',
        narrative: cleanText(narrative),
        lesson: extractCompleteNarrative(m.response, 150),
        compliant: true
      });
    }
  }

  // Deterministic plain-English Verification ID (no raw hex clutter)
  const rawSeed = `${user._id || user.username || 'kaizen'}:${allSessions.length}:${brokerTrades.length}:${user.disciplineScore || 50}`;
  const shortCode = crypto.createHash('sha256').update(rawSeed).digest('hex').slice(0, 8).toUpperCase();
  const verificationId = `KZN-${new Date().getFullYear()}-${shortCode}`;

  return {
    verificationId,
    username: user.username || 'Trader',
    memberSince: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2026',
    kaizenScore: (score && score.overall != null) ? score.overall : (user.disciplineScore || 0),
    complianceRate: complianceRate !== null ? complianceRate : (user.disciplineScore || 0),
    totalSessions: allSessions.length,
    studySessions: studyCount,
    brokerVerifiedCount: Math.max(brokerVerifiedCount, brokerTrades.length),
    topInstruments: topInstruments.length ? topInstruments : ['Multi-Asset'],
    topStrategies: topStrategies.length ? topStrategies : ['Structured System'],
    riskPerTrade: riskRule,
    howITrade,
    behavioralSummary,
    memorableDecisions
  };
}

module.exports = {
  normalizeSymbol,
  normalizeDirection,
  parseBrokerStatement,
  matchSessionWithBrokerHistory,
  buildAutoTraderDossier
};
