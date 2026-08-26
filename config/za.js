const axios = require('axios');

const DEFAULT_ZA_API_URL = 'https://zeroauthoritydao.com/api';
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * ZA_BASE_URL is a base URL, not an endpoint. Accept both the documented
 * https://zeroauthoritydao.com/api value and the host-only value so a Render
 * environment setting cannot accidentally send requests to /bounties (the
 * website route) instead of /api/bounties (the JSON API route).
 */
function normalizeBaseUrl(value) {
  const configured = typeof value === 'string' && value.trim()
    ? value.trim()
    : DEFAULT_ZA_API_URL;
  const parsed = new URL(configured);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('ZA_BASE_URL must use http or https');
  }

  let pathname = parsed.pathname.replace(/\/+$/, '');

  // Treat a host-only value as the Zero Authority API host. Also tolerate an
  // endpoint being supplied by mistake; controller calls append resources.
  if (!pathname || pathname === '/') {
    pathname = '/api';
  } else if (/\/api\/bounties$/i.test(pathname)) {
    pathname = pathname.replace(/\/bounties$/i, '');
  } else if (/^\/bounties$/i.test(pathname)) {
    pathname = '/api';
  }

  parsed.pathname = pathname;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function extractCollection(payload, keys) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidates = keys || ['data', 'bounties', 'users'];
  for (const key of candidates) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  // Some API gateways wrap the response once more in `data`.
  if (payload.data && typeof payload.data === 'object') {
    return extractCollection(payload.data, candidates);
  }

  return [];
}

function extractEntity(payload, keys) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  for (const key of keys || ['data', 'bounty']) {
    if (payload[key] && typeof payload[key] === 'object' && !Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return payload;
}

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
};

if (process.env.ZA_API_KEY) {
  headers.Authorization = `Bearer ${process.env.ZA_API_KEY}`;
}

const zaClient = axios.create({
  baseURL: normalizeBaseUrl(process.env.ZA_BASE_URL),
  headers,
  timeout: Number(process.env.ZA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
});

// Keep the parsing helpers on the client export so controllers and tests use
// the same response contract as the live ZA API.
module.exports = Object.assign(zaClient, {
  DEFAULT_ZA_API_URL,
  normalizeBaseUrl,
  extractCollection,
  extractEntity
});
