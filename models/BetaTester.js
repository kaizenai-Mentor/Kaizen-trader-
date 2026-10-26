const mongoose = require('mongoose');

const betaTesterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 160
  },
  primaryMarket: {
    type: String,
    default: 'Forex',
    trim: true
  },
  stage: {
    type: String,
    default: 'Learning Trader',
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.BetaTester || mongoose.model('BetaTester', betaTesterSchema);
