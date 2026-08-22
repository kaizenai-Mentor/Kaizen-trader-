const mongoose = require('mongoose');

/**
 * One-time nonce for Stacks wallet ownership verification.
 *
 * Security properties:
 *  - The raw nonce is NEVER stored — only its SHA-256 hash. If the database
 *    leaks, leaked nonce hashes cannot be replayed or reversed.
 *  - Single-use: consumed atomically (usedAt set in the same query that
 *    finds it), so a captured request cannot be replayed.
 *  - Short-lived: expiresAt enforced in queries + MongoDB TTL index cleanup.
 */
const walletConnectNonceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    nonceHash: {
      type: String,
      required: true,
      unique: true
    },
    // The exact message the wallet must sign. Stored so verification uses the
    // identical string even if clients try to substitute their own.
    message: {
      type: String,
      required: true
    },
    network: {
      type: String,
      enum: ['mainnet', 'testnet'],
      default: 'mainnet'
    },
    expiresAt: {
      type: Date,
      required: true
    },
    usedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// TTL: MongoDB deletes nonce documents shortly after expiry even if unused.
walletConnectNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 });

module.exports = mongoose.model('WalletConnectNonce', walletConnectNonceSchema);
