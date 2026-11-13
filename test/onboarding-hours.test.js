const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ejs = require('ejs');
const User = require('../models/User');
const TradingSystem = require('../models/TradingSystem');
const { postOnboardingRules } = require('../controllers/authController');

test('onboarding offers session choices and a custom-hours field', () => {
  const view = fs.readFileSync('views/register.ejs', 'utf8');
  ejs.compile(view, { filename: 'views/register.ejs' });
  assert.match(view, /<select class="k-input" id="tradingHours" name="tradingHours">/);
  for (const name of ['Asian session', 'London session', 'New York session', 'Multiple sessions', 'Flexible schedule']) assert.ok(view.includes(name));
  assert.match(view, /name="customTradingHours"/);
});

test('onboarding stores the chosen session or the trader’s exact custom hours', async t => {
  const find = User.findById, ensure = TradingSystem.ensureForUser;
  t.after(() => { User.findById = find; TradingSystem.ensureForUser = ensure; });
  User.findById = async () => ({ _id: 'u1' });
  let system;
  TradingSystem.ensureForUser = async () => system;
  async function run(body) {
    system = { riskRules: {}, async saveAsNewVersion() { this.saved = true; } };
    const res = { redirect(url) { this.location = url; } };
    await postOnboardingRules({ session: { user: { id: 'u1' } }, body }, res);
    assert.equal(res.location, '/dashboard/sessions/new');
    assert.equal(system.saved, true);
    return system.tradingHours;
  }
  assert.equal(await run({ tradingHours: 'London session' }), 'London session');
  assert.equal(await run({ tradingHours: 'CUSTOM', customTradingHours: ' 8am to 11am WAT ' }), '8am to 11am WAT');
  assert.equal(await run({ tradingHours: 'Multiple sessions', customTradingHours: 'London and New York' }), 'London and New York');
  assert.equal(await run({ tradingHours: 'CUSTOM', customTradingHours: '' }), undefined);
});

test('session response label uses the requested wording', () => {
  const en = require('../config/locales/en');
  assert.equal(en['kaizen.responds'], 'KAIZEN RESPONSE');
});
