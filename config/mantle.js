/**
 * Mantle integration — KaizenBenchmark.sol (contracts/KaizenBenchmark.sol).
 *
 * ROLE (docs/VISION.md): KAIZEN calculates off-chain; Mantle RECORDS.
 * The chain never computes anything — it is the immutable evidence layer.
 *
 * THE ZERO-DISPLAY BUG THIS FILE NOW PREVENTS (owner report, 15 Sep 2026):
 * The contract was deployed from Termux (deploy-quick.js) → the deployer
 * key is the contract OWNER, and onlyOwner guards every record function.
 * Meanwhile every read in the old code required MANTLE_PRIVATE_KEY (a
 * write credential) and every failure silently collapsed to zeros:
 *   - no private key set        → reads returned {0,0,0} silently
 *   - server key ≠ deployer key → every journal-triggered write REVERTED
 *     ("Not authorized") — but reverted txs still appear in the explorer,
 *     looking like they "went through", while the contract state stays
 *     empty and the page correctly reads real zeros.
 *
 * FIXES:
 *   1. Reads use a plain provider — they need ONLY the contract address.
 *   2. Writers pre-flight with staticCall: reverts are caught BEFORE gas
 *      is spent, and logged LOUDLY with the owner-mismatch explanation.
 *   3. getStatus() explains any zero (not configured / unreachable /
 *      no contract code / writer not owner / genuinely empty).
 *   4. getRecentEvents() lists actual on-chain records (eth_getLogs) with
 *      tx hashes + explorer links, so the page shows evidence, not just
 *      counts.
 *
 * hashUserId() is UNCHANGED — it must keep producing the same bytes32 for
 * data already recorded on-chain.
 */
const crypto = require('crypto');

let ethers;
try {
  ethers = require('ethers');
} catch (e) {
  console.log('ethers not installed — Mantle disabled');
}

const CONTRACT_ABI = [
  "function recordScoreChange(bytes32,uint8,uint8,string)",
  "function recordPattern(bytes32,string,string)",
  "function recordMilestone(bytes32,string,uint8)",
  "function getTotalEvents() view returns (uint256,uint256,uint256)",
  "function getUserStats(bytes32) view returns (uint8,uint256,uint256)",
  "function owner() view returns (address)"
];

const EVENT_ABI = [
  "event ScoreChanged(bytes32 indexed userId, uint8 previousScore, uint8 newScore, string reason, uint256 timestamp)",
  "event PatternDetected(bytes32 indexed userId, string patternType, string severity, uint256 timestamp)",
  "event MilestoneReached(bytes32 indexed userId, string milestoneType, uint8 score, uint256 timestamp)"
];

const DEFAULT_RPC = 'https://rpc.sepolia.mantle.xyz';

function hashUserId(userId) {
  return '0x' + crypto.createHash('sha256').update(userId.toString()).digest('hex');
}

function rpcUrl() {
  return process.env.MANTLE_RPC_URL || DEFAULT_RPC;
}

/** Reads are public — a private key must NEVER be required for them. */
function getReadContract() {
  if (!ethers) return null;
  if (!process.env.MANTLE_CONTRACT_ADDRESS) return null;
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl());
    return new ethers.Contract(
      process.env.MANTLE_CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );
  } catch (e) {
    console.error('Mantle read-contract init error:', e.message);
    return null;
  }
}

/** Writes need the server wallet (which must be the contract owner). */
function getWriteContract() {
  if (!ethers) return null;
  if (!process.env.MANTLE_PRIVATE_KEY || !process.env.MANTLE_CONTRACT_ADDRESS) {
    return null;
  }
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl());
    const wallet = new ethers.Wallet(process.env.MANTLE_PRIVATE_KEY, provider);
    return new ethers.Contract(
      process.env.MANTLE_CONTRACT_ADDRESS,
      CONTRACT_ABI,
      wallet
    );
  } catch (e) {
    console.error('Mantle write-contract init error:', e.message);
    return null;
  }
}

// ── Network helpers ──────────────────────────────────────────────

function networkName(chainId) {
  const id = Number(chainId);
  if (id === 5003) return 'Mantle Sepolia (testnet)';
  if (id === 5000) return 'Mantle';
  return id ? `chain ${id}` : 'unknown network';
}

function explorerBase() {
  return /sepolia/i.test(rpcUrl())
    ? 'https://explorer.sepolia.mantle.xyz'
    : 'https://explorer.mantle.xyz';
}

function explorerLink(kind, value) {
  // kind: 'address' | 'tx'
  return `${explorerBase()}/${kind}/${value}`;
}

// ── Diagnostics — why is it zero? ────────────────────────────────

/**
 * One non-throwing health check. Answers: is Mantle configured, reachable,
 * is there really a contract at the address, who owns it, is the server
 * wallet the owner (can it write?), and what do the counters say.
 */
async function getStatus() {
  const status = {
    ethersInstalled: !!ethers,
    rpc: rpcUrl(),
    chainId: null,
    network: null,
    contractAddress: process.env.MANTLE_CONTRACT_ADDRESS || null,
    contractHasCode: null,
    owner: null,
    writer: null,
    writerIsOwner: null,
    totals: { scores: 0, patterns: 0, milestones: 0, total: 0 },
    issues: []
  };

  if (!ethers) {
    status.issues.push('ethers is not installed — Mantle fully disabled');
    return status;
  }
  if (!process.env.MANTLE_CONTRACT_ADDRESS) {
    status.issues.push('MANTLE_CONTRACT_ADDRESS is not set — nothing to read. Deploy (contracts/deploy-quick.js) and set the printed address.');
    return status;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl());
    const net = await provider.getNetwork();
    status.chainId = Number(net.chainId);
    status.network = networkName(status.chainId);

    const code = await provider.getCode(process.env.MANTLE_CONTRACT_ADDRESS);
    status.contractHasCode = code && code !== '0x';
    if (!status.contractHasCode) {
      status.issues.push(`No contract found at ${process.env.MANTLE_CONTRACT_ADDRESS} on ${status.network} — the address is for a different network, or the deployment was to another chain.`);
      return status;
    }

    const c = new ethers.Contract(process.env.MANTLE_CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    try {
      status.owner = await c.owner();
    } catch (e) { /* non-standard or failed read — leave null */ }

    if (process.env.MANTLE_PRIVATE_KEY) {
      try {
        const wallet = new ethers.Wallet(process.env.MANTLE_PRIVATE_KEY);
        status.writer = wallet.address;
        status.writerIsOwner = !!status.owner &&
          wallet.address.toLowerCase() === status.owner.toLowerCase();
        if (!status.writerIsOwner) {
          status.issues.push(`Writer ${wallet.address} is NOT the contract owner${status.owner ? ' (' + status.owner + ')' : ''} — every record transaction will revert with "Not authorized". Use the deployer key as MANTLE_PRIVATE_KEY, or call transferOwnership on the contract.`);
        }
      } catch (e) {
        status.issues.push('MANTLE_PRIVATE_KEY is set but invalid: ' + e.message);
      }
    } else {
      status.issues.push('MANTLE_PRIVATE_KEY is not set — recording is OFF (reads still work).');
    }

    const r = await c.getTotalEvents();
    const s = Number(r[0]), p = Number(r[1]), m = Number(r[2]);
    status.totals = { scores: s, patterns: p, milestones: m, total: s + p + m };
    if (s + p + m === 0) {
      status.issues.push('Contract is reachable but holds zero records — every past write likely reverted (see writer/owner), or nothing was ever recorded.');
    }
  } catch (e) {
    status.issues.push('RPC unreachable (' + rpcUrl() + '): ' + e.message);
  }

  return status;
}

// ── Event reading (the actual on-chain records) ─────────────────

function eventInterface() {
  return new ethers.Interface(EVENT_ABI);
}

/** Decode one eth_getLogs entry into a display record. Returns null if unparsable. */
function decodeEventLog(log) {
  try {
    const iface = eventInterface();
    const parsed = iface.parseLog({ data: log.data, topics: log.topics });
    if (!parsed) return null;
    const v = parsed.args;
    const ts = Number(v.timestamp || 0);
    const base = {
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      ts: ts ? ts * 1000 : null,
      userId: v.userId
    };
    switch (parsed.name) {
      case 'ScoreChanged':
        return { ...base, type: 'SCORE', label: `Score ${Number(v.previousScore)} → ${Number(v.newScore)}`, reason: v.reason };
      case 'PatternDetected':
        return { ...base, type: 'PATTERN', label: `Pattern: ${v.patternType}`, reason: v.severity };
      case 'MilestoneReached':
        return { ...base, type: 'MILESTONE', label: `Milestone: ${v.milestoneType}`, reason: `score ${Number(v.score)}` };
      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}

/**
 * Recent on-chain records (all three event types), newest first.
 * Optional userId filter (topic1). Falls back to a recent-block window
 * if the RPC rejects full-history getLogs.
 */
async function getRecentEvents({ userId, limit = 10 } = {}) {
  const out = [];
  if (!ethers || !process.env.MANTLE_CONTRACT_ADDRESS) return out;
  try {
    const iface = eventInterface();
    const provider = new ethers.JsonRpcProvider(rpcUrl());
    const topics = [
      [
        iface.getEvent('ScoreChanged').topicHash,
        iface.getEvent('PatternDetected').topicHash,
        iface.getEvent('MilestoneReached').topicHash
      ]
    ];
    if (userId) topics.push(hashUserId(userId));

    const fetchLogs = (fromBlock) => provider.send('eth_getLogs', [{
      address: process.env.MANTLE_CONTRACT_ADDRESS,
      fromBlock: typeof fromBlock === 'number' ? '0x' + fromBlock.toString(16) : fromBlock,
      toBlock: 'latest',
      topics
    }]);

    let logs;
    try {
      logs = await fetchLogs('earliest');
    } catch (rangeErr) {
      // Some public RPCs cap the block range — retry with the last ~50k blocks.
      const latest = Number(await provider.send('eth_blockNumber', []));
      logs = await fetchLogs(Math.max(0, latest - 50000));
    }

    out.push(...logs.map(decodeEventLog).filter(Boolean));
    out.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
    return out.slice(0, limit);
  } catch (err) {
    console.error('Mantle getRecentEvents error:', err.message);
    return out;
  }
}

// ── Writers (pre-flighted so reverts never burn gas silently) ────

async function preflight(c, method, args) {
  try {
    await c[method].staticCall(...args);
    return null;
  } catch (e) {
    const msg = e && (e.shortMessage || e.reason || e.message) || String(e);
    const ownerNote = /not authorized/i.test(msg)
      ? ' — the server wallet is not the contract owner. Use the deployer (Termux) key as MANTLE_PRIVATE_KEY, or transferOwnership to the server wallet.'
      : '';
    console.error(`Mantle ${method} pre-flight revert: ${msg}${ownerNote}`);
    return new Error(`Mantle ${method} would revert: ${msg}${ownerNote}`);
  }
}

async function recordScoreChange(userId, previousScore, newScore, reason) {
  const c = getWriteContract();
  if (!c) return null;
  const args = [hashUserId(userId), Math.min(Math.max(previousScore, 0), 100), Math.min(Math.max(newScore, 0), 100), reason];
  const fail = await preflight(c, 'recordScoreChange', args);
  if (fail) return null;
  try {
    const tx = await c.recordScoreChange(...args, { gasLimit: 200000 });
    console.log('Mantle score change tx:', tx.hash);
    await tx.wait();
    return tx.hash;
  } catch (err) {
    console.error('Mantle recordScoreChange error:', err.message);
    return null;
  }
}

async function recordPattern(userId, patternType, severity) {
  const c = getWriteContract();
  if (!c) return null;
  const args = [hashUserId(userId), patternType, severity];
  const fail = await preflight(c, 'recordPattern', args);
  if (fail) return null;
  try {
    const tx = await c.recordPattern(...args, { gasLimit: 200000 });
    console.log('Mantle pattern tx:', tx.hash);
    await tx.wait();
    return tx.hash;
  } catch (err) {
    console.error('Mantle recordPattern error:', err.message);
    return null;
  }
}

async function recordMilestone(userId, milestoneType, score) {
  const c = getWriteContract();
  if (!c) return null;
  const args = [hashUserId(userId), milestoneType, Math.min(Math.max(score, 0), 100)];
  const fail = await preflight(c, 'recordMilestone', args);
  if (fail) return null;
  try {
    const tx = await c.recordMilestone(...args, { gasLimit: 200000 });
    console.log('Mantle milestone tx:', tx.hash);
    await tx.wait();
    return tx.hash;
  } catch (err) {
    console.error('Mantle recordMilestone error:', err.message);
    return null;
  }
}

// ── Reads (public — no key needed) ───────────────────────────────

async function getTotalEvents() {
  const d = { scores: 0, patterns: 0, milestones: 0, total: 0 };
  const c = getReadContract();
  if (!c) return d;
  try {
    const r = await c.getTotalEvents();
    const s = Number(r[0]), p = Number(r[1]), m = Number(r[2]);
    return { scores: s, patterns: p, milestones: m, total: s + p + m };
  } catch (err) {
    console.error('Mantle getTotalEvents error:', err.message);
    return d;
  }
}

async function getUserStats(userId) {
  const d = { currentScore: 0, sessionCount: 0, milestoneCount: 0 };
  const c = getReadContract();
  if (!c) return d;
  try {
    const r = await c.getUserStats(hashUserId(userId));
    return {
      currentScore: Number(r[0] ?? 0),
      sessionCount: Number(r[1] ?? 0),
      milestoneCount: Number(r[2] ?? 0)
    };
  } catch (err) {
    console.error('Mantle getUserStats error:', err.message);
    return d;
  }
}

module.exports = {
  recordScoreChange,
  recordPattern,
  recordMilestone,
  getTotalEvents,
  getUserStats,
  getRecentEvents,
  getStatus,
  hashUserId,
  networkName,
  explorerBase,
  explorerLink,
  decodeEventLog,
  _internals: { getReadContract, getWriteContract, eventInterface }
};
