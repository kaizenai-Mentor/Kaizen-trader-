/**
 * Stacks DeFi protocol registry for activity classification.
 *
 * IMPORTANT: deployer addresses below are verified against official protocol
 * documentation (checked 2026-08):
 *   ALEX     — https://docs.alexlab.co/developers/integrations/networks/mainnet
 *   Bitflow  — https://docs.bitflow.finance/bitflow-documentation/developers/deployed-contracts/stacks
 *   Velar    — https://docs.velar.com/velar/developers/contract-addresses
 *   Arkadiko — https://docs.arkadiko.finance/additional-resources/contracts
 *   Zest     — https://docs.zestprotocol.com/start/zest-token/zest (token deployer;
 *              v2 market deployer not yet published here → coverage: partial)
 *
 * Add new protocols by appending deployer addresses — the indexer picks them
 * up automatically. Keep everything mainnet unless prefixed otherwise.
 */

const PROTOCOLS = {
  alex: {
    name: 'ALEX Lab',
    category: 'dex',
    deployers: ['SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9']
  },
  bitflow: {
    name: 'Bitflow',
    category: 'dex',
    deployers: [
      'SPQC38PW542EQJ5M11CR25P7BS1CA6QT4TBXGB3M',
      // protocol-address constant referenced inside Bitflow contracts
      'SP3GDP77BDSZ4VN2QQP057C9T6DRDDB6WGES6K9CP'
    ]
  },
  velar: {
    name: 'Velar',
    category: 'dex',
    deployers: ['SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1']
  },
  arkadiko: {
    name: 'Arkadiko',
    category: 'cdp-stablecoin',
    deployers: ['SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR']
  },
  zest: {
    name: 'Zest',
    category: 'lending',
    coverage: 'partial',
    deployers: ['SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7']
  }
};

// Deployer address -> protocol key (built once).
const DEPLOYER_INDEX = {};
for (const [key, proto] of Object.entries(PROTOCOLS)) {
  for (const addr of proto.deployers) DEPLOYER_INDEX[addr] = key;
}

/**
 * Action classification from function names — deterministic, keyword-based.
 * Ordered: first match wins. Covers common Stacks DeFi naming conventions.
 */
const ACTION_PATTERNS = [
  { action: 'swap', patterns: ['swap', 'exchange', 'route'] },
  { action: 'add-liquidity', patterns: ['add-liquidity', 'mint-lp', 'deposit-liquidity', 'add-to-pool'] },
  { action: 'remove-liquidity', patterns: ['remove-liquidity', 'burn-lp', 'withdraw-liquidity', 'remove-from-pool'] },
  { action: 'stake', patterns: ['stake', 'stack', 'lock', 'commit'] },
  { action: 'unstake', patterns: ['unstake', 'unstack', 'unlock', 'revoke'] },
  { action: 'borrow', patterns: ['borrow', 'draw', 'mint-usda', 'open-vault', 'collateralize-and'] },
  { action: 'repay', patterns: ['repay', 'close-vault', 'liquidate'] },
  { action: 'deposit', patterns: ['deposit', 'supply', 'lend'] },
  { action: 'withdraw', patterns: ['withdraw', 'redeem', 'claim-collateral'] },
  { action: 'claim', patterns: ['claim', 'harvest', 'collect'] },
  { action: 'transfer', patterns: ['transfer', 'send'] },
  { action: 'approve', patterns: ['approve', 'set-allowed', 'allow'] },
  { action: 'deploy', patterns: [] } // special-cased for tx_type === 'smart_contract'
];

/**
 * Classify a transaction.
 * @param {string} contractId  e.g. "SP3K8....KBR9.swap-helper-v1-03"
 * @param {string} functionName e.g. "swap-helper"
 * @param {string} txType e.g. "contract_call" | "smart_contract" | "token_transfer"
 * @returns {{ protocolKey: string|null, protocolName: string, category: string, action: string }}
 */
function classifyTx({ contractId, functionName, txType }) {
  let protocolKey = null;

  if (contractId && contractId.includes('.')) {
    const deployer = contractId.split('.')[0];
    protocolKey = DEPLOYER_INDEX[deployer] || null;
  }

  const proto = protocolKey ? PROTOCOLS[protocolKey] : null;

  let action = 'other';
  if (txType === 'token_transfer') {
    action = 'transfer';
  } else if (txType === 'smart_contract') {
    action = 'deploy';
  } else if (functionName) {
    const fn = functionName.toLowerCase();
    for (const { action: a, patterns } of ACTION_PATTERNS) {
      if (patterns.length === 0) continue;
      if (patterns.some(p => fn.includes(p))) {
        action = a;
        break;
      }
    }
  }

  return {
    protocolKey,
    protocolName: proto ? proto.name : 'Other',
    category: proto ? proto.category : 'unknown',
    action
  };
}

module.exports = { PROTOCOLS, DEPLOYER_INDEX, ACTION_PATTERNS, classifyTx };
