const crypto = require('crypto');

let ethers;
try {
  ethers = require('ethers');
} catch(e) {
  console.log('ethers not installed — Mantle disabled');
}

const CONTRACT_ABI = [
  "function recordScoreChange(bytes32 userId, uint8 previousScore, uint8 newScore, string memory reason) external",
  "function recordPattern(bytes32 userId, string memory patternType, string memory severity) external",
  "function recordMilestone(bytes32 userId, string memory milestoneType, uint8 score) external",
  "function getTotalEvents() external view returns (uint256 scores, uint256 patterns, uint256 milestones)",
  "function getUserStats(bytes32 userId) external view returns (uint8 currentScore, uint256 sessionCount, uint256 milestoneCount)"
];

function hashUserId(userId) {
  return '0x' + crypto
    .createHash('sha256')
    .update(userId.toString())
    .digest('hex');
}

let contractAvailable = null;
function getContract() {
  if (!ethers || !process.env.MANTLE_PRIVATE_KEY || !process.env.MANTLE_CONTRACT_ADDRESS) return null;
  if (contractAvailable === false) return null;
  // Async-ready version via promise memoization
  if (contractAvailable && typeof contractAvailable.then === 'function') return contractAvailable;
  contractAvailable = (async () => {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz');
      const address = ethers.getAddress(process.env.MANTLE_CONTRACT_ADDRESS);
      const code = await provider.getCode(address);
      if (!code || code === '0x') { console.log('Mantle: no contract deployed at', address, '— reads/writes no-op'); return null; }
      const wallet = new ethers.Wallet(process.env.MANTLE_PRIVATE_KEY, provider);
      return new ethers.Contract(address, CONTRACT_ABI, wallet);
    } catch (e) { console.error('Mantle init error:', e.message); return null; }
  })();
  return contractAvailable;
  }

async function recordScoreChange(userId, previousScore, newScore, reason) {
  const contract = getContract();
  if (!contract) {
    console.log('Mantle: score change logged (no contract)', {
      userId: hashUserId(userId), previousScore, newScore, reason
    });
    return null;
  }

  try {
    const userHash = hashUserId(userId);
    const tx = await contract.recordScoreChange(
      userHash,
      Math.min(Math.max(previousScore, 0), 100),
      Math.min(Math.max(newScore, 0), 100),
      reason,
      { gasLimit: 200000 }
    );
    console.log('Mantle score change tx:', tx.hash);
    await tx.wait();
    console.log('Mantle score change confirmed');
    return tx.hash;
  } catch(err) {
    console.error('Mantle recordScoreChange error:', err.message);
    return null;
  }
}

async function recordPattern(userId, patternType, severity) {
  const contract = getContract();
  if (!contract) {
    console.log('Mantle: pattern logged (no contract)', {
      userId: hashUserId(userId), patternType, severity
    });
    return null;
  }

  try {
    const userHash = hashUserId(userId);
    const tx = await contract.recordPattern(
      userHash, patternType, severity,
      { gasLimit: 200000 }
    );
    console.log('Mantle pattern tx:', tx.hash);
    await tx.wait();
    return tx.hash;
  } catch(err) {
    console.error('Mantle recordPattern error:', err.message);
    return null;
  }
}

async function recordMilestone(userId, milestoneType, score) {
  const contract = getContract();
  if (!contract) {
    console.log('Mantle: milestone logged (no contract)', {
      userId: hashUserId(userId), milestoneType, score
    });
    return null;
  }

  try {
    const userHash = hashUserId(userId);
    const tx = await contract.recordMilestone(
      userHash, milestoneType,
      Math.min(Math.max(score, 0), 100),
      { gasLimit: 200000 }
    );
    console.log('Mantle milestone tx:', tx.hash);
    await tx.wait();
    return tx.hash;
  } catch(err) {
    console.error('Mantle recordMilestone error:', err.message);
    return null;
  }
}

async function getTotalEvents() {
  const contract = getContract();
  if (!contract) return { scores: 0, patterns: 0, milestones: 0, total: 0 };
  try {
    const [scores, patterns, milestones] = await contract.getTotalEvents();
    const total = Number(scores) + Number(patterns) + Number(milestones);
    return {
      scores: Number(scores),
      patterns: Number(patterns),
      milestones: Number(milestones),
      total
    };
  } catch(err) {
    console.error('Mantle getTotalEvents error:', err.message);
    return { scores: 0, patterns: 0, milestones: 0, total: 0 };
  }
}

async function getUserStats(userId) {
  const defaults = { currentScore: 0, sessionCount: 0, milestoneCount: 0 };
  const contract = getContract();
  if (!contract) return defaults;
  try {
    const userHash = hashUserId(userId);
    const raw = await contract.getUserStats(userHash);
    // ethers v6 returns a Result object; be defensive about tuple vs named access.
    if (!raw) return defaults;
    const currentScore = Number(
      raw.currentScore ?? raw[0] ?? 0
    );
    const sessionCount = Number(
      raw.sessionCount ?? raw[1] ?? 0
    );
    const milestoneCount = Number(
      raw.milestoneCount ?? raw[2] ?? 0
    );
    return { currentScore, sessionCount, milestoneCount };
  } catch(err) {
    console.error('Mantle getUserStats error:', err.message);
    return defaults;
  }
}

module.exports = {
  recordScoreChange,
  recordPattern,
  recordMilestone,
  getTotalEvents,
  getUserStats,
  hashUserId
};
