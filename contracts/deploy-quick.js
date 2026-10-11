/**
 * KAIZEN — quick deploy (REWRITTEN 15 Sep 2026 — the stale-bytecode trap is gone).
 *
 * HISTORY (why this file was rewritten):
 *   This script used to contain a HARDCODED bytecode string that was copied
 *   from an OLD deployment. Every run of it re-deployed that same OLD code,
 *   no matter what KaizenBenchmark.sol said at the time. The contracts it
 *   produced did NOT contain the functions the app calls
 *   (recordScoreChange / recordPattern / recordMilestone / getTotalEvents),
 *   so every on-chain write reverted and the reputation page stayed at zero.
 *
 *   It also carried a NEWER ABI pasted above that OLD bytecode — a mismatched
 *   pair that made the script *look* correct while deploying the wrong code.
 *
 * NOW: this script behaves exactly like deploy.js — it compiles the CURRENT
 * KaizenBenchmark.sol fresh on every run. There is no cached bytecode
 * anywhere in this repo anymore, so a deploy can never silently ship an
 * outdated contract again.
 *
 * Usage (from the contracts/ folder, after `npm install`):
 *   MANTLE_PRIVATE_KEY=0xYourKey node deploy-quick.js
 *   (Fund the address with testnet MNT from faucet.sepolia.mantle.xyz first.)
 *
 * After deploying:
 *   1. Put the printed address into Render → MANTLE_CONTRACT_ADDRESS
 *   2. Make sure Render's MANTLE_PRIVATE_KEY is the SAME key you deployed with
 *   3. Run check-owner.js — it now also verifies the deployed code is the
 *      current build, not a stale one.
 */
require('./deploy.js');
