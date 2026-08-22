const BlockchainActivity = require('../models/BlockchainActivity');
const ConnectedWallet = require('../models/ConnectedWallet');
const DisciplineCredential = require('../models/DisciplineCredential');
const behaviorMetrics = require('./behaviorMetrics');
const rulesEngine = require('./rulesEngine');
const { decrypt } = require('../utils/cryptoVault');

/**
 * Generates and saves discipline credentials for a user based on their wallet activity.
 */
async function refreshCredentials(userId) {
  const wallet = await ConnectedWallet.findOne({ userId, status: 'active' });
  if (!wallet || !wallet.consent || !wallet.consent.activityAnalysis) {
    return { credentials: [], error: 'No active wallet with activity analysis consent.' };
  }

  const activities = await BlockchainActivity.find({ walletId: wallet._id }).sort({ occurredAt: 1 });
  
  if (activities.length === 0) {
    return { credentials: [], message: 'No activity found to evaluate.' };
  }

  // Compute metrics (default 30-day window)
  const metrics = behaviorMetrics.computeMetrics(activities);
  
  // Evaluate rules
  const earnedRules = rulesEngine.evaluateRules(metrics);
  
  const address = decrypt(wallet.addressEncrypted);
  const newCredentials = [];

  for (const rule of earnedRules) {
    try {
      // Upsert the credential
      const credential = await DisciplineCredential.findOneAndUpdate(
        { 
          userId, 
          walletId: wallet._id, 
          credentialType: rule.ruleId 
        },
        {
          $set: {
            address,
            network: wallet.network,
            name: rule.name,
            description: rule.description,
            evidence: {
              metricValue: rule.evidence.metricValue,
              windowDays: rule.evidence.windowDays,
              computedAt: new Date(rule.evaluatedAt)
            },
            issuedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
      newCredentials.push(credential);
    } catch (err) {
      console.error(`Error issuing credential ${rule.ruleId}:`, err);
    }
  }

  return {
    credentials: newCredentials,
    metrics,
    evaluatedCount: earnedRules.length
  };
}

module.exports = {
  refreshCredentials
};
