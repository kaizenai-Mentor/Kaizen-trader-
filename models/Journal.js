const mongoose = require('mongoose');

const JournalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  asset: {
    type: String,
    required: true,
    default: 'General'
  },
  timeframe: {
    type: String,
    default: 'N/A'
  },
  notes: {
    type: String,
    required: true
  },
  emotion: {
    type: String,
    default: 'Neutral'
  },
  ruleCompliance: {
    type: Boolean,
    default: true
  },
  violations: [{
    type: String
  }],
  sessionScore: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  direction: {
    type: String,
    default: 'Live Trade'
  },
  outcome: {
    type: String,
    default: 'No Trade',
    enum: ['Win', 'Loss', 'Breakeven', 'No Trade', 'Pending']
  },
  rrAchieved: {
    type: String,
    default: null
  },
  pipsGained: {
    type: String,
    default: null
  },
  hasChartImage: {
    type: Boolean,
    default: false
  },

  // ── V2 SESSION EXTENSION (config/App.js B5) ─────────────────────
  // All fields optional: legacy journal entries remain valid Sessions
  // with the plan stage empty ("no plan" = reduced Process evidence,
  // never a punishment).
  sessionType: {
    type: String,
    enum: ['LIVE', 'BACKTEST', 'STUDY'],
    default: 'LIVE'
  },
  state: {
    type: String,
    enum: ['PLANNED', 'RECORDED', 'REFLECTED', 'ANALYZED'],
    default: 'RECORDED'
  },
  plan: {
    setup: { type: String, default: '' },
    entryCondition: { type: String, default: '' },
    invalidation: { type: String, default: '' },
    predefinedRisk: { type: String, default: '' },
    emotionalState: { type: String, default: '' },
    confidence: { type: Number, default: null, min: 1, max: 10 },
    skipped: { type: Boolean, default: false },
    systemVersion: { type: Number, default: null },
    createdAt: { type: Date, default: null }
  },
  quickChecks: {
    followedPlan: {
      type: String,
      enum: ['YES', 'NO', 'NO_PLAN', 'NOT_MENTIONED'],
      default: 'NOT_MENTIONED'
    },
    withinEntryCriteria: {
      type: String,
      enum: ['YES', 'NO', 'NOT_MENTIONED'],
      default: 'NOT_MENTIONED'
    },
    respectedRisk: {
      type: String,
      enum: ['YES', 'NO', 'NOT_MENTIONED'],
      default: 'NOT_MENTIONED'
    }
  },
  reflection: {
    whatHappened: { type: String, default: '' },
    followedProcess: { type: String, default: '' },
    learned: { type: String, default: '' },
    wouldChange: { type: String, default: '' },
    completedAt: { type: Date, default: null }
  },
  evidenceFlags: {
    // Session Integrity Layer (config/App.js B6b)
    beyondCadence: { type: Boolean, default: false },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, default: null },
    lowSignal: { type: Boolean, default: false },
    extracted: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  // ── END V2 EXTENSION ────────────────────────────────────────────

  aiAnalysis: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Journal', JournalSchema);
