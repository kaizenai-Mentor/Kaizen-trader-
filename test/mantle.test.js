/**
 * Mantle integration tests — offline: no network, no chain access.
 * Covers the fixes for the "returns zero but explorer shows txs" bug:
 * read/write contract gating, event decoding, network helpers, and the
 * unchanged user-hash (backward compatibility with on-chain data).
 */
const test = require('node:test');
const assert = require('node:assert');
const mantle = require('../config/mantle');

// Isolate env for gating tests
const ENV_KEYS = ['MANTLE_RPC_URL', 'MANTLE_CONTRACT_ADDRESS', 'MANTLE_PRIVATE_KEY'];
const savedEnv = {};
for (const k of ENV_KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }

test('reads need ONLY the contract address — never a private key', () => {
  const { getReadContract, getWriteContract } = mantle._internals;
  // nothing set → both null
  assert.equal(getReadContract(), null);
  assert.equal(getWriteContract(), null);
  // address only → READ works (this was the zero-display bug: reads
  // used to demand a key), write stays off
  process.env.MANTLE_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
  const rc = getReadContract();
  assert.ok(rc, 'read contract must exist with address only');
  assert.equal(getWriteContract(), null);
  // both set → write works too
  process.env.MANTLE_PRIVATE_KEY = '0x' + 'ab'.repeat(32);
  assert.ok(getWriteContract());
});

test('networkName maps chain ids honestly', () => {
  assert.equal(mantle.networkName(5003), 'Mantle Sepolia (testnet)');
  assert.equal(mantle.networkName(5000), 'Mantle');
  assert.equal(mantle.networkName(999), 'chain 999');
  assert.equal(mantle.networkName(null), 'unknown network');
});

test('explorer base follows the configured RPC network', () => {
  process.env.MANTLE_RPC_URL = 'https://rpc.sepolia.mantle.xyz';
  assert.equal(mantle.explorerBase(), 'https://explorer.sepolia.mantle.xyz');
  assert.equal(mantle.explorerLink('tx', '0xabc'), 'https://explorer.sepolia.mantle.xyz/tx/0xabc');
  process.env.MANTLE_RPC_URL = 'https://rpc.mantle.xyz';
  assert.equal(mantle.explorerBase(), 'https://explorer.mantle.xyz');
  delete process.env.MANTLE_RPC_URL;
});

test('hashUserId is UNCHANGED — existing on-chain records stay addressable', () => {
  // sha256 of the raw id string, hex-prefixed — must never drift.
  const expected = '0x' + require('crypto').createHash('sha256').update('u1').digest('hex');
  assert.equal(mantle.hashUserId('u1'), expected);
  assert.equal(mantle.hashUserId(42), '0x' + require('crypto').createHash('sha256').update('42').digest('hex'));
});

// ── Event decoding (the recent-records list) ─────────────────────

const { ethers } = require('ethers');

function fixtureLog(eventName, args) {
  const iface = mantle._internals.eventInterface();
  const { data, topics } = iface.encodeEventLog(eventName, args);
  return { data, topics, transactionHash: '0x' + 'cd'.repeat(32), blockNumber: 1234 };
}

test('decodeEventLog reads ScoreChanged with all fields', () => {
  const userHash = mantle.hashUserId('u1');
  const ev = mantle.decodeEventLog(fixtureLog('ScoreChanged', [userHash, 61, 74, 'Two clean sessions this week.', 1770000000n]));
  assert.equal(ev.type, 'SCORE');
  assert.equal(ev.label, 'Score 61 → 74');
  assert.equal(ev.reason, 'Two clean sessions this week.');
  assert.equal(ev.txHash, '0x' + 'cd'.repeat(32));
  assert.equal(ev.ts, 1770000000 * 1000);
  assert.equal(ev.userId, userHash);
});

test('decodeEventLog reads PatternDetected and MilestoneReached', () => {
  const userHash = mantle.hashUserId('u2');
  const p = mantle.decodeEventLog(fixtureLog('PatternDetected', [userHash, 'revenge', 'medium', 1770000100n]));
  assert.equal(p.type, 'PATTERN');
  assert.equal(p.label, 'Pattern: revenge');
  assert.equal(p.reason, 'medium');

  const m = mantle.decodeEventLog(fixtureLog('MilestoneReached', [userHash, 'sessions_25', 80, 1770000200n]));
  assert.equal(m.type, 'MILESTONE');
  assert.equal(m.label, 'Milestone: sessions_25');
  assert.equal(m.reason, 'score 80');
});

test('decodeEventLog returns null for foreign logs instead of throwing', () => {
  assert.equal(mantle.decodeEventLog({ data: '0x', topics: ['0xdeadbeef'] }), null);
  assert.equal(mantle.decodeEventLog(null), null);
});

// restore env
test.after?.(() => {});
for (const k of ENV_KEYS) {
  if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k];
  else delete process.env[k];
}
