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
    default: 'BTC/USDT'
  },
  timeframe: {
    type: String,
    default: '1H'
  },
  notes: {
    type: String,
    required: true
  },
  emotion: {
    type: String,
    enum: ['Fear', 'Greed', 'Neutral', 'Confident', 'Anxious'],
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
    enum: ['Long', 'Short', 'No Trade'],
    default: 'No Trade'
  },
  outcome: {
    type: String,
    enum: ['Win', 'Loss', 'Breakeven', 'Pending'],
    default: 'Pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Journal', JournalSchema);