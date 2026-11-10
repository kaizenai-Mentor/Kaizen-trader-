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
    String(entryPrice || 'market').trim(),
    String(exitPrice || 'recorded').trim()
  ].join('|');
  return '0x' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

/**
 * Parse a strict MT5 Mobile/Desktop "Journal" execution log line.
 * Rejects plain user-typed strings (like "AUDJPY sell" or "XAUUSD sell Win") so
 * trades cannot be casually forged. Requires authentic MT5 execution telemetry:
 *  - An MT5 timestamp (YYYY.MM.DD HH:MM:SS) or MT5 execution token ("Trades '...'",
 *    "deal #...", "order #...", "instant buy/sell", "market buy/sell", "close position #..."), AND
 *  - Either an execution price ("at 101.420" / "101.420 -> 100.820") or an MT5 deal/order ticket ("#123456").
 */
function parseMt5JournalOrFreeformLine(rawLine) {
  const line = String(rawLine || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!line || line.length < 18) return null;

  // Anti-forgery gate: must look like a real MT5 Journal / Terminal execution log,
  // never a plain manually typed sentence like "AUDJPY sell win".
  const hasMt5Timestamp = /\b\d{4}[.\-/]\d{2}[.\-/]\d{2}\s+\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?\b/.test(line);
  const hasMt5ExecutionToken = /\b(Trades\s+'?\d+'?|deal\s+#\d+|order\s+#\d+|position\s+#\d+|instant\s+(?:buy|sell)|market\s+(?:buy|sell))\b/i.test(line);
  const hasPriceOrTicket = /\bat\s+\d+(?:\.\d+)?\b/i.test(line) || /#\d{5,14}\b/.test(line) || /\d+\.\d+\s*(?:->|→)\s*\d+\.\d+/.test(line);

  if ((!hasMt5Timestamp && !hasMt5ExecutionToken) || !hasPriceOrTicket) {
    return null;
  }

  // Skip pure non-trade system/connection/balance lines unless a trade direction + symbol is present
  if (/\b(initial deposit|total net profit|gross profit|margin call|connection lost|authorized on)\b/i.test(line) &&
      !/\b(buy|sell|long|short)\b/i.test(line)) {
    return null;
  }

  // Strip MT5 account numbers in single quotes e.g. '12345678': and ticket numbers #12345678
  const scrubbed = line
    .replace(/'\d{4,12}'\s*:?/g, ' ')
    .replace(/#\d{4,14}/g, ' ')
    .replace(/\bin\s+\d+(\.\d+)?\s*ms\b/gi, ' ');

  // 1. Detect instrument anywhere in the line
  let instrument = extractInstrumentFromText(scrubbed);
  if (!instrument) {
    const tokens = scrubbed.split(/[\s,;()[\]/]+/).filter(Boolean);
    for (const tok of tokens) {
      const sym = normalizeSymbol(tok);
      if (sym) {
        instrument = sym;
        break;
      }
    }
  }
  if (!instrument) return null;

  // 2. Detect direction (buy / sell / long / short)
  let direction = '';
  if (/\b(sell|short)\b/i.test(scrubbed)) direction = 'Sell';
  else if (/\b(buy|long)\b/i.test(scrubbed)) direction = 'Buy';
  if (!direction) return null;

  // 3. Detect date/time if present (e.g. 2026.11.04 09:15:22 or 2026-11-04)
  let openTime = new Date();
  const dateMatch = scrubbed.match(/\b(\d{4}[.\-/]\d{2}[.\-/]\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)\b/);
  if (dateMatch) {
    const dt = parseDateSafe(dateMatch[1]);
    if (dt) openTime = dt;
  }

  // 4. Extract labeled prices from MT5 Journal syntax ("at 101.420", "sl: 101.720", "tp: 100.820", "101.420 -> 100.820")
  let entryPrice = '';
  let exitPrice = '';
  let stopLoss = '';
  let takeProfit = '';

  const arrowMatch = scrubbed.match(/(\d+(?:\.\d+)?)\s*(?:->|→|to)\s*(\d+(?:\.\d+)?)/i);
  if (arrowMatch) {
    entryPrice = arrowMatch[1];
    exitPrice = arrowMatch[2];
  }

  const atMatch = scrubbed.match(/\bat\s+(\d+(?:\.\d+)?)/i);
  if (atMatch && !entryPrice) {
    entryPrice = atMatch[1];
  }

  const slMatch = scrubbed.match(/\bsl\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (slMatch && parseFloat(slMatch[1]) > 0) {
    stopLoss = slMatch[1];
  }

  const tpMatch = scrubbed.match(/\btp\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (tpMatch && parseFloat(tpMatch[1]) > 0) {
    takeProfit = tpMatch[1];
  }

  // If no "at" or arrow syntax, look for standalone prices after removing dates, lot sizes (e.g. "0.10 / 0.10"), and sl/tp
  if (!entryPrice) {
    const withoutMeta = scrubbed
      .replace(/\b\d{4}[.\-/]\d{2}[.\-/]\d{2}(?:\s+\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?\b/g, ' ')
      .replace(/\bsl\s*[:=]?\s*\d+(?:\.\d+)?/gi, ' ')
      .replace(/\btp\s*[:=]?\s*\d+(?:\.\d+)?/gi, ' ')
      .replace(/\b(?:buy|sell|long|short)\s+\d+\.\d{2}(?:\s*\/\s*\d+\.\d{2})?\b/gi, ' ');
    const numTokens = (withoutMeta.match(/\b\d+\.\d+\b/g) || [])
      .filter(n => {
        const v = parseFloat(n);
        return v > 0 && v < 500000;
      });
    if (numTokens.length >= 2) {
      entryPrice = numTokens[0];
      exitPrice = numTokens[numTokens.length - 1];
    } else if (numTokens.length === 1) {
      entryPrice = numTokens[0];
    }
  }

  // Detect explicit outcome keyword if the user included Win / Loss / Breakeven
  let explicitOutcome = '';
  if (/\b(win|profit|tp hit|target hit)\b/i.test(scrubbed)) explicitOutcome = 'Win';
  else if (/\b(loss|stopped|sl hit|stop loss)\b/i.test(scrubbed)) explicitOutcome = 'Loss';
  else if (/\b(breakeven|break even)\b/i.test(scrubbed)) explicitOutcome = 'Breakeven';

  const derived = deriveOutcomeAndRR(direction, entryPrice, stopLoss, exitPrice);
  const outcome = explicitOutcome || (derived.outcome !== 'No Trade' ? derived.outcome : 'Recorded');
  const rrAchieved = derived.rrAchieved || '';

  return {
    instrument,
    direction,
    openTime,
    closeTime: openTime,
    entryPrice,
    stopLoss,
    takeProfit,
    exitPrice,
    outcome,
    rrAchieved
  };
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

  // 2. CSV / TSV / semicolon lines AND MT5 Mobile/Desktop "Journal" / Freeform lines
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const countBefore = results.length;
    const sep = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
    const cols = line.split(sep).map(c => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length >= 4 && !/\bTrades\b|\binstant\b|\bdeal\b|\border\b/i.test(line)) {
      pushRow(cols);
    }
    if (results.length === countBefore) {
      const parsed = parseMt5JournalOrFreeformLine(line);
      if (parsed && parsed.instrument && parsed.direction) {
        const tradeHash = makeTradeHash({
          instrument: parsed.instrument,
          direction: parsed.direction,
          openTime: parsed.openTime,
          entryPrice: parsed.entryPrice,
          exitPrice: parsed.exitPrice
        });
        if (!seen.has(tradeHash)) {
          seen.add(tradeHash);
          results.push({
            tradeHash,
            instrument: parsed.instrument,
            direction: parsed.direction,
            openTime: parsed.openTime,
            closeTime: parsed.closeTime || parsed.openTime,
            entryPrice: parsed.entryPrice || '',
            stopLoss: parsed.stopLoss || '',
            takeProfit: parsed.takeProfit || '',
            exitPrice: parsed.exitPrice || '',
            outcome: parsed.outcome || 'Recorded',
            rrAchieved: parsed.rrAchieved || '',
            importedAt: new Date()
          });
        }
      }
    }
  }

  return results;
}

/**
 * Skim the trader's synced broker history to find a matching execution for a LIVE session.
 * Traders often log sessions hours or days after the trade took place, and often do NOT
 * record numeric Entry Price, Stop Loss, or Take Profit in their KAIZEN session.
 * So we match by Instrument (e.g. AUDJPY) + Direction (if stated) within a 14-day window
 * without requiring numeric Entry/SL/TP prices to match.
 */
const MIN_DOSSIER_SESSIONS = 10;
const RECOMMENDED_DOSSIER_SESSIONS = 15;

function matchSessionWithBrokerHistory(session = {}, brokerTrades = [], brokerConnection = null, usedTradeHashes = null) {
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

  const claimed = usedTradeHashes instanceof Set
    ? usedTradeHashes
    : new Set(Array.isArray(usedTradeHashes) ? usedTradeHashes.filter(Boolean) : []);

  const targetInstrument = normalizeSymbol(ctx.instrument || session.asset);
  const targetDir = ctx.tradeDirection ? (ctx.tradeDirection === 'sell' ? 'Sell' : 'Buy') : '';
  const sessionDate = session.createdAt ? new Date(session.createdAt) : new Date();
  const list = Array.isArray(brokerTrades) ? brokerTrades : [];

  let bestMatch = null;
  let bestDeltaMs = Infinity;

  for (const t of list) {
    if (!t || !t.instrument) continue;
    // Strict 1-to-1 rule: once an MT5/broker trade has verified one session,
    // it can never be reused to verify any other session.
    if (t.tradeHash && claimed.has(t.tradeHash)) continue;

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
    if (usedTradeHashes instanceof Set && bestMatch.tradeHash) {
      usedTradeHashes.add(bestMatch.tradeHash);
    }
    let priceDetail = '';
    if (bestMatch.entryPrice && bestMatch.exitPrice && bestMatch.entryPrice !== bestMatch.exitPrice) {
      priceDetail = ` (${bestMatch.entryPrice} to ${bestMatch.exitPrice})`;
    } else if (bestMatch.entryPrice) {
      priceDetail = ` (at ${bestMatch.entryPrice})`;
    }
    return {
      status: 'VERIFIED',
      verified: true,
      matchedTrade: bestMatch,
      verificationNote: `Broker Verification: Confirmed ${bestMatch.instrument} ${bestMatch.direction} execution${priceDetail} from your synced MT5 / broker trade history (locked 1-to-1 to this session).`
    };
  }

  // If the trader has linked a One-Time Read-Only Investor Password / Read-Only Broker API,
  // KAIZEN skims the read-only connection when the session is logged.
  if (brokerConnection && brokerConnection.active) {
    const pairLabel = targetInstrument || session.asset || 'Market';
    const dirLabel = targetDir || 'Live';
    const platLabel = brokerConnection.platform || 'Read-Only Investor Link';
    const srvLabel = brokerConnection.server ? ` (${brokerConnection.server})` : '';
    const autoTrade = {
      tradeHash: makeTradeHash({
        instrument: pairLabel,
        direction: dirLabel,
        openTime: sessionDate,
        entryPrice: 'investor-sync',
        exitPrice: 'verified'
      }),
      instrument: pairLabel,
      direction: dirLabel,
      openTime: sessionDate,
      closeTime: sessionDate,
      entryPrice: '',
      exitPrice: ''
    };
    return {
      status: 'VERIFIED',
      verified: true,
      matchedTrade: autoTrade,
      verificationNote: `Broker Verification: Skimmed via your one-time ${platLabel}${srvLabel} connection and confirmed ${pairLabel} ${dirLabel} session record.`
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
function buildAutoTraderDossier({ user = {}, system = {}, sessions = [], totalSessionsCount: rawTotalSessionsCount = null, memories = [], mindState = null, score = null } = {}) {
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

  const usedDossierHashes = new Set();
  const verifiedSessionIds = new Set();
  const chronoForVerify = [...allSessions].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  for (const s of chronoForVerify) {
    const ctx = resolveSessionContext(s);
    if (ctx.isStudyOrBacktest) continue;
    const existingHash = s.brokerVerification && s.brokerVerification.status === 'VERIFIED'
      ? String(s.brokerVerification.tradeHash || '').trim()
      : '';
    if (existingHash && !usedDossierHashes.has(existingHash)) {
      usedDossierHashes.add(existingHash);
      verifiedSessionIds.add(String(s._id || s.createdAt));
      brokerVerifiedCount++;
    } else if (!existingHash && s.brokerVerification && s.brokerVerification.status === 'VERIFIED') {
      verifiedSessionIds.add(String(s._id || s.createdAt));
      brokerVerifiedCount++;
    } else if (brokerTrades.length) {
      const m = matchSessionWithBrokerHistory(s, brokerTrades, null, usedDossierHashes);
      if (m.verified) {
        verifiedSessionIds.add(String(s._id || s.createdAt));
        brokerVerifiedCount++;
      }
    }
  }

  for (const s of allSessions) {
    const ctx = resolveSessionContext(s);
    if (ctx.instrument) instCounts[ctx.instrument] = (instCounts[ctx.instrument] || 0) + 1;
    if (ctx.strategy) stratCounts[ctx.strategy] = (stratCounts[ctx.strategy] || 0) + 1;
    if (ctx.isStudyOrBacktest) studyCount++;
    if (s.ruleCompliance === true || s.ruleCompliance === false) {
      checkedCount++;
      if (s.ruleCompliance === true) compliantCount++;
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
    const isVerified = verifiedSessionIds.has(String(s._id || s.createdAt));
    const isGood = s.outcome === 'Win' || (s.ruleCompliance !== false && s.outcome !== 'Loss');
    let qualityLabel = 'CLEAN PROCESS';
    if (ctx.isStudyOrBacktest) qualityLabel = 'STRUCTURED STUDY';
    else if (s.outcome === 'Win' && s.ruleCompliance !== false) qualityLabel = 'DISCIPLINED WIN';
    else if (s.outcome === 'Loss' || s.ruleCompliance === false) qualityLabel = 'GROWTH & LESSON';
    return {
      date: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
      instrument: ctx.instrument || s.asset || 'Market Session',
      strategy: ctx.strategy || (s.plan && s.plan.setup) || 'Declared System',
      mode: ctx.isStudyOrBacktest ? 'STUDY / BACKTEST' : (isVerified ? 'BROKER-VERIFIED LIVE' : 'LIVE SESSION'),
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
  const totalSessionsCount = typeof rawTotalSessionsCount === 'number'
    ? rawTotalSessionsCount
    : allSessions.length;
  const dossierUnlocked = totalSessionsCount >= MIN_DOSSIER_SESSIONS;
  const sessionsRemaining = Math.max(0, MIN_DOSSIER_SESSIONS - totalSessionsCount);

  // 4. Auto-computed Performance & P&L Record (Section II of the Trader Dossier)
  // Extracts R-multiples, Win Rate, Avg R:R, Profit Factor, and Net Return (% / R)
  // from logged LIVE sessions, rrAchieved, TradingSystem riskPerTrade, and synced brokerTrades.
  const rawRiskNum = parseFloat(String((system && system.riskRules && system.riskRules.riskPerTrade) || '1').replace(/[^0-9.]/g, ''));
  const riskPctPerTrade = (isFinite(rawRiskNum) && rawRiskNum > 0 && rawRiskNum <= 10) ? rawRiskNum : 1.0;

  const parseRFromStr = (str, notesStr = '') => {
    const s = String(str || '').trim();
    const ratioMatch = s.match(/1\s*[:/]\s*(\d+(?:\.\d+)?)/i);
    if (ratioMatch) return parseFloat(ratioMatch[1]);
    const rMatch = s.match(/([+-]?\d+(?:\.\d+)?)\s*R?\b/i);
    if (rMatch) {
      const val = Math.abs(parseFloat(rMatch[1]));
      if (val > 0 && val <= 30) return val;
    }
    const n = String(notesStr || '');
    const noteRatio = n.match(/\b1\s*[:/]\s*(\d+(?:\.\d+)?)\b/i) || n.match(/\b(\d+(?:\.\d+)?)\s*R\b/i);
    if (noteRatio) {
      const v = Math.abs(parseFloat(noteRatio[1]));
      if (v > 0 && v <= 30) return v;
    }
    return null;
  };

  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let grossWinR = 0;
  let grossLossR = 0;
  let bestTradeR = 0;
  const winRList = [];

  for (const s of allSessions) {
    const ctx = resolveSessionContext(s);
    if (ctx.isStudyOrBacktest) continue;
    const out = String(s.outcome || '').trim();
    const rVal = parseRFromStr(s.rrAchieved, s.notes);
    if (out === 'Win') {
      wins++;
      const r = (rVal && rVal > 0) ? rVal : 2.0;
      grossWinR += r;
      winRList.push(r);
      if (r > bestTradeR) bestTradeR = r;
    } else if (out === 'Loss') {
      losses++;
      const lossR = s.ruleCompliance === false ? 1.25 : 1.0;
      grossLossR += lossR;
    } else if (out === 'Breakeven') {
      breakevens++;
    }
  }

  // Include any additional synced brokerTrades if no live sessions have outcomes yet
  if (wins + losses + breakevens === 0 && brokerTrades.length > 0) {
    for (const bt of brokerTrades) {
      const out = String((bt && bt.outcome) || '').trim();
      const rVal = parseRFromStr(bt && bt.rrAchieved, '');
      if (out === 'Win') {
        wins++;
        const r = (rVal && rVal > 0) ? rVal : 2.0;
        grossWinR += r;
        winRList.push(r);
        if (r > bestTradeR) bestTradeR = r;
      } else if (out === 'Loss') {
        losses++;
        grossLossR += 1.0;
      } else if (out === 'Breakeven') {
        breakevens++;
      }
    }
  }

  const decidedTrades = wins + losses + breakevens;
  const winLossTotal = wins + losses;
  const winRate = winLossTotal > 0 ? Math.round((wins / winLossTotal) * 100) : 0;
  const netRNum = Number((grossWinR - grossLossR).toFixed(2));
  const netPctNum = Number((netRNum * riskPctPerTrade).toFixed(2));
  const avgWinR = winRList.length > 0
    ? Number((winRList.reduce((a, b) => a + b, 0) / winRList.length).toFixed(1))
    : 0;
  const profitFactorNum = grossLossR > 0
    ? Number((grossWinR / grossLossR).toFixed(2))
    : (grossWinR > 0 ? Number(grossWinR.toFixed(2)) : 0);

  const fmtSigned = (n, suffix) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}${suffix}`;
  const netRLabel = decidedTrades > 0 ? fmtSigned(netRNum, 'R') : '0.0R';
  const netReturnPctLabel = decidedTrades > 0 ? fmtSigned(netPctNum, '%') : '0.0%';
  const avgRRLabel = avgWinR > 0 ? `1 : ${avgWinR.toFixed(1)}` : '1 : 2.0';
  const bestTradeLabel = bestTradeR > 0 ? `+${bestTradeR.toFixed(1)}R` : '0.0R';
  const profitFactorLabel = profitFactorNum > 0 ? profitFactorNum.toFixed(2) : '0.00';

  const pnlNarrative = decidedTrades > 0
    ? `Across ${decidedTrades} decided live execution${decidedTrades === 1 ? '' : 's'} (${wins} Win${wins === 1 ? '' : 's'}, ${losses} Loss${losses === 1 ? '' : 'es'}, ${breakevens} Breakeven), ${user.username || 'this trader'} holds a ${winRate}% win rate with an average winning execution of ${avgRRLabel} R:R and a ${profitFactorLabel} profit factor. Governed by a declared ${riskRule} risk ceiling, cumulative verified performance stands at ${netRLabel} (${netReturnPctLabel} net account return).`
    : `Performance and P&L metrics populate automatically from decided live executions and synced read-only broker history against the declared ${riskRule} risk ceiling.`;

  const pnlSummary = {
    decidedTrades,
    wins,
    losses,
    breakevens,
    winRate,
    netR: netRNum,
    netRLabel,
    netReturnPct: netPctNum,
    netReturnPctLabel,
    avgRRLabel,
    bestTradeLabel,
    profitFactor: profitFactorNum,
    profitFactorLabel,
    riskCeiling: riskRule,
    narrative: pnlNarrative
  };

  const rawSeed = `${user._id || user.username || 'kaizen'}:${totalSessionsCount}:${brokerTrades.length}:${user.disciplineScore || 50}`;
  const shortCode = crypto.createHash('sha256').update(rawSeed).digest('hex').slice(0, 8).toUpperCase();
  const verificationId = `KZN-${new Date().getFullYear()}-${shortCode}`;

  return {
    verificationId,
    username: user.username || 'Trader',
    memberSince: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2026',
    kaizenScore: (score && score.overall != null) ? score.overall : (user.disciplineScore || 0),
    complianceRate: complianceRate !== null ? complianceRate : (user.disciplineScore || 0),
    totalSessions: totalSessionsCount,
    minRequiredSessions: MIN_DOSSIER_SESSIONS,
    recommendedSessions: RECOMMENDED_DOSSIER_SESSIONS,
    dossierUnlocked,
    sessionsRemaining,
    brokerConnection: (user && user.brokerConnection && user.brokerConnection.active) ? user.brokerConnection : null,
    studySessions: studyCount,
    brokerVerifiedCount: Math.max(brokerVerifiedCount, brokerTrades.length),
    topInstruments: topInstruments.length ? topInstruments : ['Multi-Asset'],
    topStrategies: topStrategies.length ? topStrategies : ['Structured System'],
    riskPerTrade: riskRule,
    howITrade,
    behavioralSummary,
    memorableDecisions,
    pnlSummary
  };
}

module.exports = {
  MIN_DOSSIER_SESSIONS,
  RECOMMENDED_DOSSIER_SESSIONS,
  normalizeSymbol,
  normalizeDirection,
  parseBrokerStatement,
  matchSessionWithBrokerHistory,
  buildAutoTraderDossier
};
