const mongoose = require('mongoose');

/**
 * A Stacks wallet cryptographically linked to a KAIZEN account.
 *
 * Privacy design:
 *  - The raw wallet address is stored AES-256-GCM ENCRYPTED (addressEncrypted).
 *  - Lookups use addressHmac (keyed HMAC-SHA256) — a database dump without the
 *    server HMAC/encryption keys reveals nothing linkable.
 *  - The public key is stored in hex (it is public information anyway — it is
 *    derivable from any signature the wallet has ever produced).
 *  - Consent snapshot: which consent version the user agreed to at link time.
 *  - indexCursor fields are reserved for Phase 1B (Hiro API activity ingestion).
 */
const connectedWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    network: {
      type: String,
      enum: ['mainnet', 'testnet'],
      default: 'mainnet'
    },
    addressHmac: {
      type: String,
      required: true
    },
    addressEncrypted: {
      type: String,
      required: true
    },
    publicKeyHex: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'disconnected'],
      default: 'active'
    },
    verifiedAt: {
      type: Date,
      default: Date.now
    },
    verificationMethod: {
      type: String,
      default: 'sip018-personal-sign'
    },
    // Hash of the nonce consumed during verification (audit trail).
    nonceHash: {
      type: String,
      default: null
    },
    consentVersion: {
      type: String,
      default: '1.0'
    },
    consent: {
      ownershipConfirmed: { type: Boolean, default: true },
      activityAnalysis: { type: Boolean, default: false }
    },
    // Phase 1B placeholders — Hiro API ingestion cursor.
    indexCursor: {
      lastBlockHeight: { type: Number, default: null },
      lastSyncedAt: { type: Date, default: null },
      txCount: { type: Number, default: 0 }
    },
    disconnectedAt: { type: Date, default: null },
    // If a wallet was re-linked from a different account (signature proves
    // current control), keep an audit pointer to the previous owner.
    previousUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reLinkedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// A wallet address (per network) can only be registered once across all users.
connectedWalletSchema.index({ network: 1, addressHmac: 1 }, { unique: true });

module.exports = mongoose.model('ConnectedWallet', connectedWalletSchema);
