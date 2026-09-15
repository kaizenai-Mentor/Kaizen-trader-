/**
 * KAIZEN — Mantle contract diagnostic (run anywhere with node + ethers).
 *
 * Answers the owner's exact questions:
 *   - Who OWNS the contract?          (the deployer — onlyOwner guards writes)
 *   - What address does my server key control?   (if MANTLE_PRIVATE_KEY is set)
 *   - Do they MATCH?                  (if not, every record write reverts)
 *   - Does the contract run the CURRENT code?    (old builds revert every
 *     write too — the app's functions don't exist on them)
 *   - Does the contract hold any records?
 *
 * Usage (Termux or Render shell, from the contracts/ folder):
 *   MANTLE_CONTRACT_ADDRESS=0x... node check-owner.js
 *   MANTLE_CONTRACT_ADDRESS=0x... MANTLE_PRIVATE_KEY=0x... node check-owner.js
 *
 * No private key is needed to see the owner — only to check the match.
 * NEVER paste a private key into a website or chat; env vars only.
 */
const { ethers } = require('ethers');

const RPC = process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
const ADDRESS = process.env.MANTLE_CONTRACT_ADDRESS;
const KEY = process.env.MANTLE_PRIVATE_KEY;

const ABI = [
  'function owner() view returns (address)',
  'function getTotalEvents() view returns (uint256, uint256, uint256)'
];

async function main() {
  console.log('KAIZEN Mantle diagnostic');
  console.log('=======================');
  console.log('RPC:', RPC);

  if (!ADDRESS) {
    console.error('\n✗ MANTLE_CONTRACT_ADDRESS is not set.');
    console.error('  Set it to the address printed when you deployed (deploy-quick.js).');
    process.exit(1);
  }
  console.log('Contract:', ADDRESS);

  const provider = new ethers.JsonRpcProvider(RPC);

  let net;
  try {
    net = await provider.getNetwork();
    console.log('Network:', Number(net.chainId) === 5003 ? 'Mantle Sepolia (testnet)' :
      Number(net.chainId) === 5000 ? 'Mantle (mainnet)' : `chain ${Number(net.chainId)}`);
  } catch (e) {
    console.error('\n✗ RPC unreachable:', e.message);
    process.exit(1);
  }

  const code = await provider.getCode(ADDRESS);
  if (!code || code === '0x') {
    console.error('\n✗ No contract found at that address on this network.');
    console.error('  The address and the network do not match — check MANTLE_CONTRACT_ADDRESS');
    console.error('  and MANTLE_RPC_URL against your deployment output.');
    process.exit(1);
  }
  console.log('Contract code: present ✓');

  // Code freshness — the fingerprint test.
  // The current KaizenBenchmark.sol build MUST contain these function
  // selectors in its bytecode: recordScoreChange (42c4aa4c) and
  // getTotalEvents (61606940). The old 1,970-byte build that caused the
  // zero-records bug contains NEITHER — its functions have different names
  // and signatures, so the app's calls simply don't exist on it and every
  // write reverts, no matter which key sends it.
  const codeLower = code.toLowerCase();
  const isCurrentBuild =
    codeLower.includes('42c4aa4c') && codeLower.includes('61606940');
  if (isCurrentBuild) {
    console.log('Contract code: CURRENT KaizenBenchmark build ✓');
  } else {
    console.error('\n✗ OLD CONTRACT CODE detected.');
    console.error('  This contract does NOT contain the current');
    console.error('  KaizenBenchmark.sol functions — recordScoreChange and');
    console.error('  getTotalEvents are missing from its bytecode. The app\'s');
    console.error('  writes will revert ("execution reverted") no matter which');
    console.error('  key you use, because the functions don\'t exist on it.');
    console.error('  This is what kept the reputation page at zero.');
    console.error('  FIX: git pull the current repo on Termux, then redeploy');
    console.error('  with contracts/deploy.js (or deploy-quick.js — both now');
    console.error('  compile the current source), and point Render\'s');
    console.error('  MANTLE_CONTRACT_ADDRESS at the new address.');
  }

  const c = new ethers.Contract(ADDRESS, ABI, provider);

  // Owner (the deployer — constructor sets owner = msg.sender)
  let owner = null;
  try {
    owner = await c.owner();
    console.log('\nOwner (the deployer wallet):', owner);
    console.log('  → Check this against the explorer too: open');
    console.log(`    https://explorer.sepolia.mantle.xyz/address/${ADDRESS}`);
    console.log('    and look for "Creator" — it should be the same address.');
  } catch (e) {
    console.error('\n✗ Could not read owner():', e.message);
  }

  // Writer (what address the server key controls)
  if (KEY) {
    try {
      const wallet = new ethers.Wallet(KEY);
      console.log('\nServer key controls:', wallet.address);
      if (owner) {
        const match = wallet.address.toLowerCase() === owner.toLowerCase();
        if (match) {
          console.log('\n✓ MATCH — the server key IS the owner. Writes will succeed.');
        } else {
          console.error('\n✗ MISMATCH — the server key is NOT the owner.');
          console.error('  Every record transaction will revert with "Not authorized".');
          console.error('  Reverted transactions still show in the explorer but record nothing.');
          console.error('  FIX: set MANTLE_PRIVATE_KEY (on Render) to the SAME key you');
          console.error('  deployed with from Termux. The deployed contract has NO');
          console.error('  transferOwnership function, so the key itself must match.');
        }
      }
    } catch (e) {
      console.error('\n✗ MANTLE_PRIVATE_KEY is invalid:', e.message);
    }
  } else {
    console.log('\n(server key not provided — set MANTLE_PRIVATE_KEY to check the match)');
  }

  // Records
  try {
    const r = await c.getTotalEvents();
    const s = Number(r[0]), p = Number(r[1]), m = Number(r[2]);
    console.log(`\nRecords on-chain: ${s} score, ${p} pattern, ${m} milestone (total ${s + p + m})`);
    if (s + p + m === 0) {
      console.log('  Zero records — consistent with every past write having reverted');
      console.log('  (old contract code, or an owner/key mismatch), or nothing');
      console.log('  recorded yet.');
    }
  } catch (e) {
    console.error('Could not read totals:', e.message);
    if (!isCurrentBuild) {
      console.error('  → Expected on an OLD build: getTotalEvents() does not exist');
      console.error('    on it. Redeploy the current source (see above).');
    }
  }
}

main().catch(e => {
  console.error('Diagnostic failed:', e.message);
  process.exit(1);
});
