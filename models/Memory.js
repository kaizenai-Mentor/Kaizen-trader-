const mongoose = require('mongoose');

const MemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionData: {
    type: String,
    default: ''
  },
  response: {
    type: String,
    required: true
  },
  asset: {
    type: String,
    default: ''
  },
  sessionScore: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const mongoose = require('mongoose');

const MemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionData: {
    type: String,
    default: ''
  },
  response: {
    type: String,
    required: true
  },
  asset: {
    type: String,
    default: ''
  },
  sessionScore: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    default: 'journal',
    enum: ['journal', 'psychology']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Memory', MemorySchema);
