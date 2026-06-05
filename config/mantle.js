const https = require('https');
const crypto = require('crypto');

const CONTRACT_ADDRESS = process.env.MANTLE_CONTRACT_ADDRESS;
const RPC_URL = process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
const PRIVATE_KEY = process.env.MANTLE_PRIVATE_KEY;

// Hash user ID for privacy
function hashUserId(userId) {
  return '0x' + crypto.createHash('sha256')
    .update(userId.toString())
    .digest('hex');
}

// Simple RPC call to Mantle
async function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1
    });

    const url = new URL(RPC_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Record score change on Mantle
async function recordScoreChange(userId, previousScore, newScore, reason) {
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY) {
    console.log('Mantle not configured — skipping on-chain record');
    return null;
  }

  try {
    const userHash = hashUserId(userId);
    console.log(`Recording score change on Mantle: ${previousScore}% → ${newScore}%`);

    // For hackathon demo — log the event
    // Full ethers.js integration added in next step
    console.log('Mantle event:', {
      contract: CONTRACT_ADDRESS,
      userId: userHash,
      previousScore,
      newScore,
      reason,
      timestamp: new Date().toISOString()
    });

    return { success: true, userHash };
  } catch (err) {
    console.error('Mantle record error:', err.message);
    return null;
  }
}

async function recordPattern(userId, patternType, severity) {
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY) return null;
  try {
    const userHash = hashUserId(userId);
    console.log('Mantle pattern event:', { userHash, patternType, severity });
    return { success: true };
  } catch (err) {
    console.error('Mantle pattern error:', err.message);
    return null;
  }
}

async function recordMilestone(userId, milestoneType, score) {
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY) return null;
  try {
    const userHash = hashUserId(userId);
    console.log('Mantle milestone event:', { userHash, milestoneType, score });
    return { success: true };
  } catch (err) {
    console.error('Mantle milestone error:', err.message);
    return null;
  }
}

module.exports = {
  recordScoreChange,
  recordPattern,
  recordMilestone,
  hashUserId
};
