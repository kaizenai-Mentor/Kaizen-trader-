/**
 * KAIZEN Trading System — V2 first-class object (config/App.js B4).
 *
 * The versioned rules object every session is measured against.
 * Existing users migrate lazily from User.tradingStyle on first access
 * (ensureForUser) — nothing is lost, no migration script required.
 */
const mongoose = require('mongoose');

const VersionEntrySchema = new mongoose.Schema({
  version: { type: Number, required: true },
  savedAt: { type: Date, default: Date.now },
  changeNote: { type: String, default: '' },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true }
}, { _id: false });

const TradingSystemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: { type: String, default: 'My Trading System' },
  marketConditions: { type: String, default: '' },
  setups: [{ name: { type: String, trim: true } }],
  entryRules: { type: String, default: '' },
  exitRules: { type: String, default: '' },
  riskRules: {
    riskPerTrade: { type: String, default: '' },
    maxPositionSize: { type: String, default: '' },
    dailyDrawdown: { type: String, default: '' },
    maxDailyTrades: { type: String, default: '' }
  },
  positionRules: { type: String, default: '' },
  tradingHours: { type: String, default: '' },
  noTradeConditions: [{ type: String, trim: true }],
  psychologicalRules: [{ type: String, trim: true }],
  version: { type: Number, default: 1 },
  history: [VersionEntrySchema]
}, { timestamps: true });

function snapshotOf(doc) {
  return {
    name: doc.name,
    marketConditions: doc.marketConditions,
    setups: doc.setups,
    entryRules: doc.entryRules,
    exitRules: doc.exitRules,
    riskRules: doc.riskRules,
    positionRules: doc.positionRules,
    tradingHours: doc.tradingHours,
    noTradeConditions: doc.noTradeConditions,
    psychologicalRules: doc.psychologicalRules
  };
}

/**
 * Lazy migration + accessor: returns the user's TradingSystem, creating
 * version 1 from the legacy User.tradingStyle fields on first call.
 * Safe to call on every request (one indexed find).
 */
TradingSystemSchema.statics.ensureForUser = async function (user) {
  if (!user) return null;
  let system = await this.findOne({ userId: user._id });
  if (system) return system;

  const legacy = user.tradingStyle || {};
  system = new this({
    userId: user._id,
    name: 'My Trading System',
    marketConditions: '',
    setups: [],
    entryRules: legacy.entryRule || '',
    exitRules: legacy.takeProfitRule || '',
    riskRules: {
      riskPerTrade: legacy.riskPerTrade || '',
      maxPositionSize: legacy.maxPositionSize || '',
      dailyDrawdown: legacy.dailyDrawdown || '',
      maxDailyTrades: legacy.maxDailyTrades || ''
    },
    positionRules: '',
    tradingHours: '',
    noTradeConditions: legacy.stopLossRule ? [] : [],
    psychologicalRules: legacy.emotionalTriggers
      ? String(legacy.emotionalTriggers).split(',').map(s => s.trim()).filter(Boolean)
      : [],
    version: 1,
    history: [{
      version: 1,
      changeNote: 'First system, migrated from trading style.',
      snapshot: null // filled below
    }]
  });
  system.history[0].snapshot = snapshotOf(system);
  await system.save();
  return system;
};

/** Save the current editor state as a new version (never overwrites). */
TradingSystemSchema.methods.saveAsNewVersion = async function (changeNote) {
  this.version += 1;
  this.history.push({
    version: this.version,
    changeNote: changeNote || '',
    snapshot: snapshotOf(this)
  });
  return this.save();
};

module.exports = mongoose.model('TradingSystem', TradingSystemSchema);
