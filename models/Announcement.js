/**
 * Announcement — site-wide ticker entries (config/CoreLoop.js Part 3).
 * A ticker renders ONLY while an announcement is active within its
 * window; each announcement carries its own start/end dates.
 */
const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  message: { type: String, required: true, trim: true },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

AnnouncementSchema.statics.findActive = function () {
  const now = new Date();
  return this.findOne({
    active: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now }
  }).sort({ startsAt: -1 });
};

module.exports = mongoose.model('Announcement', AnnouncementSchema);
