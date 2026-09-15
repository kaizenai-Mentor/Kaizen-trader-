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
  "function getUserStats(bytes32) view returns (uint8,uint256,uint256)"
];

function hashUserId(userId) {
  return '0x' + crypto.createHash('sha256').update(userId.toString()).digest('hex');
}

function getContract() {
  if (!ethers) return null;
  if (!process.env.MANTLE_PRIVATE_KEY || !process.env.MANTLE_CONTRACT_ADDRESS) {
    return null;
  }
  try {
    const provider = new ethers.JsonRpcProvider(
      process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz'
    );
    const wallet = new ethers.Wallet(process.env.MANTLE_PRIVATE_KEY, provider);
    return new ethers.Contract(
      process.env.MANTLE_CONTRACT_ADDRESS,
      CONTRACT_ABI,
      wallet
    );
  } catch (e) {
    console.error('Mantle contract init error:', e.message);
    return null;
  }
}

async function recordScoreChange(userId, previousScore, newScore, reason) {
  const c = getContract();
  if (!c) return null;
  try {
    const tx = await c.recordScoreChange(
      hashUserId(userId),
      Math.min(Math.max(previousScore, 0), 100),
      Math.min(Math.max(newScore, 0), 100),
      reason,
      { gasLimit: 200000 }
    );
    console.log('Mantle score change tx:', tx.hash);
    await tx.wait();
    return tx.hash;
  } catch (err) {
    console.error('Mantle recordScoreChange error:', err.message);
    return null;
  }
}

async function recordPattern(userId, patternType, severity) {
  const c = getContract();
  if (!c) return null;
  try {
    const tx = await c.recordPattern(
      hashUserId(userId), patternType, severity,
      { gasLimit: 200000 }
    );
    console.log('Mantle pattern tx:', tx.hash);
    await tx.wait();
    return tx.hash;
  } catch (err) {
    console.error('Mantle recordPattern error:', err.message);
    return null;
  }
}

async function recordMilestone(userId, milestoneType, score) {
  const c = getContract();
  if (!c) return null;
  try {
    const tx = await c.recordMilestone(
      hashUserId(userId), milestoneType,
      Math.min(Math.max(score, 0), 100),
      { gasLimit: 200000 }
    );
    console.log('Mantle milestone tx:', tx.hash);
    await tx.wait();
    return tx.hash;
  } catch (err) {
    console.error('Mantle recordMilestone error:', err.message);
    return null;
  }
}

async function getTotalEvents() {
  const d = { scores: 0, patterns: 0, milestones: 0, total: 0 };
  const c = getContract();
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
  const c = getContract();
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
  hashUserId
};
