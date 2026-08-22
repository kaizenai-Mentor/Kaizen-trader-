const mongoose = require('mongoose');

/**
 * DisciplineCredential Model
 * 
 * Represents a "verifiable" (locally for now, Stacks-issuable later) 
 * claim about a user's trading discipline based on on-chain evidence.
 */
const DisciplineCredentialSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConnectedWallet',
    required: true
  },
  address: {
    type: String, // Public address associated with the credential
    required: true
  },
  network: {
    type: String,
    default: 'mainnet'
  },
  credentialType: {
    type: String, // e.g., 'consistent_activity', 'controlled_cadence'
    required: true,
    index: true
  },
  name: String,
  description: String,
  
  // The evidence that backed this credential at the time of issuance
  evidence: {
    metricValue: String,
    windowDays: Number,
    computedAt: { type: Date, default: Date.now }
  },

  issuedAt: {
    type: Date,
    default: Date.now
  },

  // For future Stacks integration
  onChainProof: {
    txId: String,
    contractAddress: String,
    status: { type: String, enum: ['pending', 'confirmed', 'none'], default: 'none' }
  }
}, { timestamps: true });

// Ensure a user/wallet only has one active credential of a specific type
// We might want to allow re-issuance, but for now, let's keep it simple.
DisciplineCredentialSchema.index({ userId: 1, walletId: 1, credentialType: 1 }, { unique: true });

module.exports = mongoose.model('DisciplineCredential', DisciplineCredentialSchema);
