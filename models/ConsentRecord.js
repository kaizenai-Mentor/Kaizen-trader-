const mongoose = require('mongoose');

/**
 * Append-only consent audit log.
 *
 * Every meaningful consent event (wallet linked, analysis consent granted or
 * revoked, wallet disconnected) is recorded with the consent-policy version,
 * so we can always prove what the user agreed to and when.
 */
const consentRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ConnectedWallet',
      default: null
    },
    type: {
      type: String,
      enum: [
        'wallet_connected',
        'activity_analysis_granted',
        'activity_analysis_revoked',
        'wallet_disconnected',
        'wallet_relinked'
      ],
      required: true
    },
    // Consent policy version the user saw (bump when wording/scope changes).
    version: {
      type: String,
      default: '1.0'
    },
    granted: {
      type: Boolean,
      default: true
    },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('ConsentRecord', consentRecordSchema);
