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
    required: true,
    minlength: 6
  },
  tradingStyle: {
    markets: { type: String, default: 'Crypto' },
    timeframes: { type: String, default: '1H' },
    strategy: { type: String, default: 'Price Action' },
    experience: { type: String, default: 'Beginner' }
  },
  rules: [{
    name: String,
    value: String,
    active: { type: Boolean, default: true }
  }],
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

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);