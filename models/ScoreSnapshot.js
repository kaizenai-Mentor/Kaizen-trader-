/**
 * ScoreSnapshot — formula-versioned score history (config/App.js B6).
 * One document per computation; the user's score timeline is the
 * chronological series. The V1-era disciplineScore lives on User and
 * freezes at cutover — these snapshots are the V2 record.
 */
const mongoose = require('mongoose');

const DimensionSchema = new mongoose.Schema({
  score: { type: Number, default: null, min: 0, max: 100 },
  // BUILDING | PARTIAL | READY
  state: { type: String, default: 'BUILDING' },
  reasons: [{ type: String }]
}, { _id: false });

const ScoreSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  formulaVersion: { type: String, required: true },
  overall: { type: Number, default: null, min: 0, max: 100 },
  overallState: { type: String, default: 'BUILDING' },
  dimensions: {
    process: DimensionSchema,
    risk: DimensionSchema,
    execution: DimensionSchema,
    behavior: DimensionSchema,
    learning: DimensionSchema
  },
  evidenceMix: {
    declared: { type: Number, default: 0 },
    extracted: { type: Number, default: 0 }
  },
  sessionsConsidered: { type: Number, default: 0 },
  computedAt: { type: Date, default: Date.now }
}, { timestamps: true });

ScoreSnapshotSchema.index({ userId: 1, computedAt: -1 });

module.exports = mongoose.model('ScoreSnapshot', ScoreSnapshotSchema);
