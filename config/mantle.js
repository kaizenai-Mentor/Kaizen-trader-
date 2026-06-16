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
  "function getTotalEvents() external view returns (uint256 scores, uint256 patterns, uint256 milestones)"
];

function hashUserId(userId) {
  return '0x' + crypto
    .createHash('sha256')
    .update(userId.toString())
    .digest('hex');
}

function getContract() {
  if (!ethers) return null;
  if (!process.env.MANTLE_PRIVATE_KEY) return null;
  if (!process.env.MANTLE_CONTRACT_ADDRESS) return null;

  try {
    const provider = new ethers.JsonRpcProvider(
      process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz'
    );
    const wallet = new ethers.Wallet(
      process.env.MANTLE_PRIVATE_KEY, provider
    );
    return new ethers.Contract(
      process.env.MANTLE_CONTRACT_ADDRESS,
      CONTRACT_ABI,
      wallet
    );
  } catch(e) {
    console.error('Mantle contract init error:', e.message);
    return null;
  }
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

module.exports = {
  recordScoreChange,
  recordPattern,
  recordMilestone,
  hashUserId
};
