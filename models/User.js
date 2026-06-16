const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    minlength: 6,
    default: null
  },
  googleId: {
    type: String,
    default: null
  },
  authMethod: {
    type: String,
    enum: ['password', 'google', 'email-link'],
    default: 'password'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    code: { type: String, default: null },
    expiresAt: { type: Date, default: null }
  },
  tradingStyle: {
    riskPerTrade: { type: String, default: '' },
    dailyDrawdown: { type: String, default: '' },
    tradingEdge: { type: String, default: '' },
    entryRule: { type: String, default: '' },
    stopLossRule: { type: String, default: '' },
    takeProfitRule: { type: String, default: '' },
    emotionalTriggers: { type: String, default: '' },
    maxDailyTrades: { type: String, default: '' },
    markets: { type: String, default: '' },
    maxPositionSize: { type: String, default: '' }
  },
  rules: [
    {
      name: String,
      value: String,
      active: { type: Boolean, default: true }
    }
  ],
  disciplineScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  streak: {
    type: Number,
    default: 0
  },
  zaUserId: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
badges: [{
  id: { type: String },
  name: { type: String },
  description: { type: String },
  earnedAt: { type: Date, default: Date.now }
}]

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
