const mongoose = require('mongoose');

/**
 * Normalized, privacy-minimal record of a confirmed on-chain transaction
 * belonging to a connected wallet.
 *
 * Deliberate omissions (privacy architecture):
 *   - NO token amounts, NO balances, NO fee values: KAIZEN computes behavior
 *     metrics from timing, cadence and protocol usage only. Reconstructing
 *     P&L from this collection is impossible by design.
 *   - Counterparties are not stored in Phase 1B.
 *
 * Everything stored here is already public on-chain; KAIZEN keeps only the
 * minimal slice needed for behavioral analysis.
 */
const blockchainActivitySchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ConnectedWallet',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    network: {
      type: String,
      enum: ['mainnet', 'testnet'],
      required: true
    },
    txId: {
      type: String,
      required: true
    },
    txType: {
      type: String, // token_transfer | contract_call | smart_contract | tenure_change | ...
      default: 'unknown'
    },
    blockHeight: {
      type: Number,
      required: true,
      index: true
    },
    blockHash: { type: String, default: null },
    occurredAt: {
      type: Date, // burn_block_time of the anchor block
      required: true,
      index: true
    },
    // Contract call metadata (only for contract_call / smart_contract txs).
    contractId: { type: String, default: null },
    functionName: { type: String, default: null },
    // Deterministic classification (see config/protocols.js).
    protocolKey: { type: String, default: null }, // 'alex' | 'bitflow' | ... | null
    protocolName: { type: String, default: 'Other' },
    protocolCategory: { type: String, default: 'unknown' },
    action: { type: String, default: 'other' },
    ingestedAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

// A transaction is ingested exactly once per network.
blockchainActivitySchema.index({ network: 1, txId: 1 }, { unique: true });
// Fast per-wallet time-range queries.
blockchainActivitySchema.index({ walletId: 1, occurredAt: -1 });

module.exports = mongoose.model('BlockchainActivity', blockchainActivitySchema);
