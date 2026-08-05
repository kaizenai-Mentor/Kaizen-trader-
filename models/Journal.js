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
