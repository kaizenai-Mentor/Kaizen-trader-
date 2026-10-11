/**
 * Announcements service — ticker data with a small in-memory cache
 * (config/CoreLoop.js Part 3). A DB round-trip per page render is
 * wasted; 60s staleness is invisible for a 20-day announcement.
 */
const mongoose = require('mongoose');

const CACHE_TTL_MS = 60 * 1000;
let cache = { value: null, at: 0, inflight: null };

async function getActiveAnnouncement() {
  const now = Date.now();
  if (cache.value !== null && now - cache.at < CACHE_TTL_MS) return cache.value;
  if (cache.inflight) return cache.inflight;

  if (mongoose.connection.readyState !== 1) return null; // no-DB preview mode

  cache.inflight = (async () => {
    try {
      const Announcement = require('../models/Announcement');
      const doc = await Announcement.findActive().lean();
      cache.value = doc ? { message: doc.message, endsAt: doc.endsAt } : null;
      cache.at = Date.now();
      return cache.value;
    } catch (e) {
      return null; // never let the ticker break a page
    } finally {
      cache.inflight = null;
    }
  })();

  return cache.inflight;
}

function invalidateCache() { cache.value = null; cache.at = 0; }

module.exports = { getActiveAnnouncement, invalidateCache };
