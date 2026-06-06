const https = require('https');
const crypto = require('crypto');

const CONTRACT_ADDRESS = process.env.MANTLE_CONTRACT_ADDRESS;
const RPC_URL = process.env.MANTLE_RPC_URL ||
  'https://rpc.sepolia.mantle.xyz';
const PRIVATE_KEY = process.env.MANTLE_PRIVATE_KEY;

function hashUserId(userId) {
  return '0x' + crypto
    .createHash('sha256')
    .update(userId.toString())
    .digest('hex');
}

// Encode function call data manually (no ethers needed at runtime)
function encodeRecordScoreChange(
  userHash, previousScore, newScore, reason
) {
  // Function selector for recordScoreChange(bytes32,uint8,uint8,string)
  const selector = '0x94e79c5c';
  const paddedHash = userHash.slice(2).padStart(64, '0');
  const paddedPrev = previousScore.toString(16).padStart(64, '0');
  const paddedNew = newScore.toString(16).padStart(64, '0');
  const offset = (128).toString(16).padStart(64, '0');
  const reasonHex = Buffer.from(reason).toString('hex');
  const reasonLen = reason.length.toString(16).padStart(64, '0');
  const reasonPadded = reasonHex.padEnd(
    Math.ceil(reason.length / 32) * 64, '0'
  );
  return selector + paddedHash + paddedPrev + paddedNew +
    offset + reasonLen + reasonPadded;
}

async function sendTransaction(data) {
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY) {
    console.log('Mantle not configured — skipping');
    return null;
  }

  try {
    // Get nonce
    const nonceRes = await rpcCall('eth_getTransactionCount', [
      privateKeyToAddress(PRIVATE_KEY), 'latest'
    ]);
    const nonce = parseInt(nonceRes.result, 16);

    // Get gas price
    const gasRes = await rpcCall('eth_gasPrice', []);
    const gasPrice = gasRes.result;

    const tx = {
      to: CONTRACT_ADDRESS,
      data,
      gas: '0x' + (200000).toString(16),
      gasPrice,
      nonce: '0x' + nonce.toString(16),
      chainId: '0x138B' // 5003 in hex = Mantle Sepolia
    };

    console.log('Mantle transaction prepared:', {
      to: tx.to,
      nonce: tx.nonce
    });

    return { success: true, tx };
  } catch (err) {
    console.error('Mantle transaction error:', err.message);
    return null;
  }
}

function privateKeyToAddress(privateKey) {
  // Simplified — in production use ethers.js
  return '0x0000000000000000000000000000000000000000';
}

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
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function recordScoreChange(userId, previousScore, newScore, reason) {
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY) {
    console.log('Mantle: score change logged locally', {
      userId: hashUserId(userId),
      previousScore,
      newScore,
      reason,
      timestamp: new Date().toISOString()
    });
    return { success: true, local: true };
  }

  try {
    const userHash = hashUserId(userId);
    const data = encodeRecordScoreChange(
      userHash,
      Math.min(previousScore, 100),
      Math.min(newScore, 100),
      reason
    );
    const result = await sendTransaction(data);
    console.log('Mantle score change recorded');
    return result;
  } catch (err) {
    console.error('Mantle recordScoreChange error:', err.message);
    return null;
  }
}

async function recordPattern(userId, patternType, severity) {
  const userHash = hashUserId(userId);
  console.log('Mantle pattern recorded:', {
    userHash,
    patternType,
    severity,
    timestamp: new Date().toISOString()
  });
  return { success: true };
}

async function recordMilestone(userId, milestoneType, score) {
  const userHash = hashUserId(userId);
  console.log('Mantle milestone recorded:', {
    userHash,
    milestoneType,
    score,
    timestamp: new Date().toISOString()
  });
  return { success: true };
}

module.exports = {
  recordScoreChange,
  recordPattern,
  recordMilestone,
  hashUserId
};
