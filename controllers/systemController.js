/**
 * My Trading System — V2 editor (config/App.js B4, Step 5 M3).
 *
 * The versioned rules object. Every save creates a new version
 * (saveAsNewVersion) — history is never overwritten, so any past
 * session can be judged against the rules that existed at the time.
 */
const TradingSystem = require('../models/TradingSystem');

const listFromText = (text) => String(text || '')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean);

async function getSystem(req, res) {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/auth/login');
    const system = await TradingSystem.ensureForUser(user);
    res.render('trading-system', {
      user: req.session.user,
      system,
      saved: req.query.saved === '1',
      title: 'My Trading System'
    });
  } catch (err) {
    console.error('Trading system load error:', err.message);
    res.redirect('/dashboard');
  }
}

async function postSystem(req, res) {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/auth/login');
    const system = await TradingSystem.ensureForUser(user);

    const b = req.body;
    system.name = (b.name || 'My Trading System').trim() || 'My Trading System';
    system.marketConditions = (b.marketConditions || '').trim();
    system.setups = listFromText(b.setups).map(name => ({ name }));
    system.entryRules = (b.entryRules || '').trim();
    system.exitRules = (b.exitRules || '').trim();
    system.positionRules = (b.positionRules || '').trim();
    system.riskRules = {
      riskPerTrade: (b.riskPerTrade || '').trim(),
      maxPositionSize: (b.maxPositionSize || '').trim(),
      dailyDrawdown: (b.dailyDrawdown || '').trim(),
      maxDailyTrades: (b.maxDailyTrades || '').trim()
    };
    system.tradingHours = (b.tradingHours || '').trim();
    system.noTradeConditions = listFromText(b.noTradeConditions);
    system.psychologicalRules = listFromText(b.psychologicalRules);

    await system.saveAsNewVersion((b.changeNote || '').trim());
    res.redirect('/settings/trading-system?saved=1');
  } catch (err) {
    console.error('Trading system save error:', err.message);
    res.redirect('/settings/trading-system');
  }
}

module.exports = { getSystem, postSystem };
