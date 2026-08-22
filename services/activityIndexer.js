/**
 * KAIZEN activity indexer — Phase 1B.
 *
 * Pulls CONFIRMED transactions for a consented wallet from the Hiro API,
 * normalizes them to the privacy-minimal BlockchainActivity model, and
 * advances the wallet's index cursor.
 *
 * Design rules:
 *   - Only wallets with consent.activityAnalysis === true are indexed.
 *   - Only tx_status === 'success' and canonical transactions are kept.
 *   - No amounts, no balances, no counterparties (see model docs).
 *   - Duplicate-safe: upserts keyed on (network, txId).
 *   - Polite to Hiro: small pages, short page caps, backoff on 429.
 */
const hiroClient = require('../config/hiro');
const BlockchainActivity = require('../models/BlockchainActivity');
const ConnectedWallet = require('../models/ConnectedWallet');
const { decrypt } = require('../utils/cryptoVault');
const { classifyTx } = require('../config/protocols');

const PAGE_SIZE = 50;
const MAX_PAGES_PER_SYNC = 6; // hard cap: 300 txs per sync run
const RETRY_DELAY_MS = 1500;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(address, offset) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await hiroClient.get(`/extended/v1/address/${address}/transactions`, {
        params: { limit: PAGE_SIZE, offset, unanchored: false }
      });
      return res.data;
    } catch (err) {
      lastErr = err;
      if (err.response && err.response.status === 429) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/** Convert one Hiro tx to our normalized doc (or null if it should be skipped). */
function normalizeTx(tx, wallet, cursorBlockHeight) {
  if (!tx || !tx.tx_id) return null;
  if (tx.tx_status !== 'success') return null; // confirmed+successful only
  if (tx.canonical === false) return null;
  if (typeof tx.block_height !== 'number') return null;

  // Incremental stop condition: already indexed.
  if (cursorBlockHeight && tx.block_height <= cursorBlockHeight) return null;

  const cc = tx.contract_call || {};
  const classification = classifyTx({
    contractId: cc.contract_id || null,
    functionName: cc.function_name || null,
    txType: tx.tx_type
  });

  const occurredMs = tx.burn_block_time
    ? tx.burn_block_time * 1000
    : Date.parse(tx.burn_block_time_iso) || Date.now();

  return {
    txId: tx.tx_id,
    txType: tx.tx_type || 'unknown',
    blockHeight: tx.block_height,
    blockHash: tx.block_hash || null,
    occurredAt: new Date(occurredMs),
    contractId: cc.contract_id || null,
    functionName: cc.function_name || null,
    protocolKey: classification.protocolKey,
    protocolName: classification.protocolName,
    protocolCategory: classification.category,
    action: classification.action,
    walletId: wallet._id,
    userId: wallet.userId,
    network: wallet.network
  };
}

/**
 * Sync one wallet. Returns { ingested, scanned, stoppedEarly, cursor }.
 * Throws { code: 'NO_CONSENT' | 'NOT_CONNECTED' | ... } for UI-friendly errors.
 */
async function syncWallet(wallet, { forceBackfill = false } = {}) {
  if (!wallet || wallet.status !== 'active') {
    const err = new Error('No active wallet connected.');
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  if (!wallet.consent || !wallet.consent.activityAnalysis) {
    const err = new Error('On-chain activity analysis consent is required. Reconnect your wallet with analysis consent enabled.');
    err.code = 'NO_CONSENT';
    throw err;
  }

  const address = decrypt(wallet.addressEncrypted);
  const cursorBlockHeight = forceBackfill ? null : wallet.indexCursor && wallet.indexCursor.lastBlockHeight;

  let scanned = 0;
  let ingested = 0;
  let stoppedEarly = false;
  let maxBlockSeen = cursorBlockHeight || 0;

  for (let page = 0; page < MAX_PAGES_PER_SYNC; page++) {
    const data = await fetchPage(address, page * PAGE_SIZE);
    const results = (data && data.results) || [];
    if (results.length === 0) break;

    const docs = [];
    for (const tx of results) {
      scanned++;
      const doc = normalizeTx(tx, wallet, cursorBlockHeight);
      if (doc) {
        docs.push(doc);
        if (doc.blockHeight > maxBlockSeen) maxBlockSeen = doc.blockHeight;
      }
    }

    if (docs.length) {
      // Idempotent upserts keyed by (network, txId).
      await BlockchainActivity.bulkWrite(
        docs.map(d => ({
          updateOne: {
            filter: { network: d.network, txId: d.txId },
            update: { $set: d },
            upsert: true
          }
        })),
        { ordered: false }
      );
      ingested += docs.length;
    }

    // If this page contained fewer rows than requested, we've hit the end
    // of the address history (or the incremental window).
    if (results.length < PAGE_SIZE) break;

    // Incremental sync: if a whole page produced no new docs, older pages
    // are already indexed — stop.
    if (cursorBlockHeight && docs.length === 0) {
      stoppedEarly = true;
      break;
    }

    // Small courtesy pause between pages (public rate limits).
    if (page < MAX_PAGES_PER_SYNC - 1) await sleep(250);
  }

  const txCount = await BlockchainActivity.countDocuments({ walletId: wallet._id });

  wallet.indexCursor = {
    lastBlockHeight: maxBlockSeen || (wallet.indexCursor && wallet.indexCursor.lastBlockHeight) || null,
    lastSyncedAt: new Date(),
    txCount
  };
  await wallet.save();

  return { ingested, scanned, stoppedEarly, total: txCount, cursor: wallet.indexCursor };
}

/** Convenience: find the user's active wallet and sync it. */
async function syncUserWallet(userId, options = {}) {
  const wallet = await ConnectedWallet.findOne({ userId, status: 'active' });
  if (!wallet) {
    const err = new Error('No active wallet connected.');
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  return syncWallet(wallet, options);
}

module.exports = { syncWallet, syncUserWallet, normalizeTx, PAGE_SIZE, MAX_PAGES_PER_SYNC };
