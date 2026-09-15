/**
 * Seed the V2 announcement ticker (config/CoreLoop.js Part 3).
 *
 * Usage:  node scripts/seed-announcement.js ["message"] [days]
 * Defaults to the PRE announcement with a 25-day window
 * (owner-locked: 20–25 days).
 *
 * Run against the production DB (Render shell or locally with
 * MONGODB_URI set). Safe to re-run — it deactivates previous
 * announcements first so only one ticker shows at a time.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

async function main() {
  const message = process.argv[2] ||
    '<b>KAIZEN V2 IS COMING</b> — the score gets five dimensions · plan → record → reflect sessions · your own Trading System · rolling out over the next 30 days';
  const days = parseInt(process.argv[3] || '25', 10);

  await connectDB();
  const Announcement = require('../models/Announcement');

  await Announcement.updateMany({}, { $set: { active: false } });
  const doc = await Announcement.create({
    message,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    active: true
  });
  console.log('Announcement active for', days, 'days:');
  console.log(' ', doc.message.replace(/<[^>]+>/g, ''));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
