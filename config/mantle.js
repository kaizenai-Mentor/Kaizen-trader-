const crypto = require('crypto');

let ethers;
try {
  ethers = require('ethers');
} catch (e) {
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
  return '0x' + crypto.createHash('sha256').update(userId.toString()).digest('hex');
}

function getContract() {
  if (!ethers) return null;
  if (!process.env.MANTLE_PRIVATE_KEY || !process.env.MANTLE_CONTRACT_ADDRESS) {
    console.log('Mantle getContract: missing env var — addr set?', !!process.env.MANTLE_CONTRACT_ADDRESS, 'pk set?', !!process.env.MANTLE_PRIVATE_KEY);
    return null;
  }
  try {
    const provider = new ethers.JsonRpcProvider(process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz');
    const wallet = new ethers.Wallet(process.env.MANTLE_PRIVATE_KEY, provider);
    return new ethers.Contract(process.env.MANTLE_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
  } catch (e) {
    console.error('Mantle contract init error:', e.message);
    return null;
  }
}

async function recordScoreChange(userId, previousScore, newScore, reason) {
  const c = getContract();
  if (!c) return null;
  try {
    const tx = await c.recordScoreChange(hashUserId(userId), Math.min(Math.max(previousScore,0),100), Math.min(Math.max(newScore,0),100), reason, {gasLimit:200000});
    console.log('Mantle score change tx:', tx.hash);
    await tx.wait();
    return tx.hash;
    } catch(err) { console.error('Mantle recordScoreChange error:', err.message); return null; }
}


async function recordPattern(userId, patternType, severity) {
  const c = getContract();
  if (!c) return null;
  try {
    const tx = await c.recordPattern(hashUserId(userId), patternType, severity, {gasLimit:200000});
    console.log('Mantle pattern tx:', tx.hash);
    await tx.wait();
    return tx.hash;
    } catch(err) { console.error('Mantle recordPattern error:', err.message); return null; }
}

async function recordMilestone(userId, milestoneType, score) {
  const c = getContract();
  if (!c) return null;
  try {
    const tx = await c.recordMilestone(hashUserId(userId), milestoneType, Math.min(Math.max(score,0),100), {gasLimit:200000});
    console.log('Mantle milestone tx:', tx.hash);
    await tx.wait();
    return tx.hash;
    } catch(err) { console.error('Mantle recordMilestone error:', err.message); return null; }
}

async function getTotalEvents() {
  const d = {scores:0,patterns:0,milestones:0,total:0};
  const c = getContract(); if (!c) return d;
  try {
    const [s,p,m] = await c.getTotalEvents();
    return {scores:Number(s),patterns:Number(p),milestones:Number(m),total:Number(s)+Number(p)+Number(m)};
    } catch(err) { console.error('Mantle getTotalEvents error:', err.message); return d; }
}

async function getUserStats(userId) {
  const d = {currentScore:0,sessionCount:0,milestoneCount:0};
  const c = getContract(); if (!c) return d;
  try {
    const raw = await c.getUserStats(hashUserId(userId));
    if (!raw) return d;
    return {
      currentScore: Number(raw.currentScore ?? raw[0] ?? 0),
      sessionCount: Number(raw.sessionCount ?? raw[1] ?? 0),
      milestoneCount: Number(raw.milestoneCount ?? raw[2] ?? 0)
    };
    } catch(err) { console.error('Mantle getUserStats error:', err.message); return d; }
}

module.exports = { recordScoreChange, recordPattern, recordMilestone, getTotalEvents, getUserStats, hashUserId };
