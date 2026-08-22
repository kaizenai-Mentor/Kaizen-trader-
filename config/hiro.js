/**
 * Hiro Stacks API client — used to ingest confirmed on-chain activity
 * for wallets the user has linked AND consented to analyze.
 *
 * Public endpoints require no key; set HIRO_API_KEY if you have one
 * (higher rate limits). Public unauthenticated limits are modest, so the
 * indexer pages slowly and backs off on 429s.
 */
const axios = require('axios');

const NETWORK = process.env.STACKS_NETWORK === 'testnet' ? 'testnet' : 'mainnet';

const BASE_URL =
  process.env.HIRO_BASE_URL ||
  (NETWORK === 'testnet' ? 'https://api.testnet.hiro.so' : 'https://api.hiro.so');

const headers = { 'Content-Type': 'application/json' };
if (process.env.HIRO_API_KEY) {
  headers['x-api-key'] = process.env.HIRO_API_KEY;
}

const hiroClient = axios.create({
  baseURL: BASE_URL,
  headers,
  timeout: 20000
});

module.exports = hiroClient;
module.exports.NETWORK = NETWORK;
