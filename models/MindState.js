/**
 * MindState — KAIZEN's living picture of the trader's psychological state.
 *
 * PERMANENT and SELF-MAINTAINING (owner decision D2, 13 Sep 2026):
 * - Nothing here is deletable. The record is the reference — it lets KAIZEN
 *   recognize a pattern when it repeats months later.
 * - The user never edits it. KAIZEN updates its own understanding after
 *   every exchange, recording improvement as it happens: themes evolve
 *   active → improving → resolved, keeping their first-seen date so the
 *   before-picture survives.
 * - Read-only to the user (visible — transparency — but maintained by KAIZEN
 *   through conversation, never by an edit UI).
 */
const mongoose = require('mongoose');

const ThemeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // active | improving | resolved — the arc of the work
  status: { type: String, enum: ['active', 'improving', 'resolved'], default: 'active' },
  note: { type: String, default: '' },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  occurrences: { type: Number, default: 1 }
}, { _id: false });

const TriggerSchema = new mongoose.Schema({
  situation: { type: String, required: true, trim: true },
  note: { type: String, default: '' },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
}, { _id: false });

const HelpSchema = new mongoose.Schema({
  what: { type: String, required: true, trim: true },
  note: { type: String, default: '' },
  lastSeen: { type: Date, default: Date.now }
}, { _id: false });

const SummaryEntrySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  summary: { type: String }
}, { _id: false });

const MindStateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  summary: { type: String, default: '' },
  themes: [ThemeSchema],
  triggers: [TriggerSchema],
  helps: [HelpSchema],
  // The summary over time — how KAIZEN's understanding evolved (capped).
  summaryHistory: { type: [SummaryEntrySchema], default: [] }
}, { timestamps: true });

/** Get (or lazily create) the user's MindState. */
MindStateSchema.statics.ensureForUser = async function (userId) {
  let state = await this.findOne({ userId });
  if (!state) state = await this.create({ userId });
  return state;
};

module.exports = mongoose.model('MindState', MindStateSchema);
