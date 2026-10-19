/**
 * models/Goal.js — improvement goals (owner directive 19 Oct 2026).
 *
 * A goal is a measurable behaviour target — never a profit target.
 * Goal Guidance (services/goalCoach.js) sets, tracks and adapts these
 * against the trader's record. Progress entries are append-only.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const goalSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  metric: {
    type: String,
    enum: ['RULE_COMPLIANCE', 'SESSIONS_PER_WEEK', 'RISK_LIMIT', 'JOURNAL_STREAK', 'CUSTOM'],
    default: 'CUSTOM'
  },
  target: { type: Number, default: null },
  unit: { type: String, default: '' },
  cadence: { type: String, enum: ['WEEKLY', 'MONTHLY'], default: 'WEEKLY' },
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'ACHIEVED', 'ARCHIVED'],
    default: 'ACTIVE'
  },
  rationale: { type: String, default: '' },
  progressLog: [{
    at: { type: Date, default: Date.now },
    value: { type: Number, default: null },
    note: { type: String, default: '' }
  }],
  guidance: { type: String, default: '' },
  guidanceAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Goal', goalSchema);
