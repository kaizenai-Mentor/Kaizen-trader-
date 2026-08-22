/**
 * KAIZEN Rules Engine — Phase 1B+
 * 
 * Evaluates deterministic behavior metrics against discipline standards
 * to generate verifiable "Discipline Credentials".
 */

const RULES = [
  {
    id: 'consistent_activity',
    name: 'Consistent Participant',
    description: 'Maintained active on-chain presence (>= 50% of days) over a 30-day window.',
    evaluate: (metrics) => {
      return metrics.consistency.activeDaysPct >= 50;
    }
  },
  {
    id: 'controlled_cadence',
    name: 'Controlled Cadence',
    description: 'Demonstrated disciplined trading frequency (no days with >10 transactions).',
    evaluate: (metrics) => {
      return !metrics.cadence.heavyTradingFlag && metrics.totals.transactions > 0;
    }
  },
  {
    id: 'defi_explorer',
    name: 'DeFi Explorer',
    description: 'Engaged with multiple protocols, showing platform diversity.',
    evaluate: (metrics) => {
      return metrics.engagement.protocolsUsed >= 3;
    }
  },
  {
    id: 'patient_trader',
    name: 'Patient Execution',
    description: 'Maintained a median gap of > 6 hours between transactions, avoiding impulsive churn.',
    evaluate: (metrics) => {
      return metrics.cadence.medianGapHours >= 6;
    }
  }
];

/**
 * Evaluates metrics against all rules.
 * @param {object} metrics The result from behaviorMetrics.computeMetrics()
 * @returns {Array} Array of earned rule results
 */
function evaluateRules(metrics) {
  const results = [];
  for (const rule of RULES) {
    const passed = rule.evaluate(metrics);
    if (passed) {
      results.push({
        ruleId: rule.id,
        name: rule.name,
        description: rule.description,
        evaluatedAt: new Date().toISOString(),
        evidence: {
          metricValue: getMetricValueForEvidence(rule.id, metrics),
          windowDays: metrics.windowDays
        }
      });
    }
  }
  return results;
}

function getMetricValueForEvidence(ruleId, metrics) {
  switch (ruleId) {
    case 'consistent_activity': return `${metrics.consistency.activeDaysPct}% active days`;
    case 'controlled_cadence': return `Max tx/day: ${metrics.cadence.maxTxInOneDay}`;
    case 'defi_explorer': return `${metrics.engagement.protocolsUsed} protocols`;
    case 'patient_trader': return `${metrics.cadence.medianGapHours}h median gap`;
    default: return null;
  }
}

module.exports = {
  RULES,
  evaluateRules
};
