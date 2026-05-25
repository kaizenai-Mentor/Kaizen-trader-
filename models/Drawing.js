const mongoose = require('mongoose');

const DrawingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  asset: {
    type: String,
    required: true
  },
  timeframe: {
    type: String,
    required: true
  },
  drawings: {
    type: Array,
    default: []
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

DrawingSchema.index({ userId: 1, asset: 1, timeframe: 1 }, { unique: true });

module.exports = mongoose.model('Drawing', DrawingSchema);
