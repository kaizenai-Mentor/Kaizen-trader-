/**
 * The 20 Oct 2026 page merges (owner directive) — pinned so the navbar
 * and destinations can never drift back:
 *   1. Psychology is NOT a destination — it lives inside KAIZEN AI
 *      (one conversation, five layers, patterns visible on the page).
 *   2. Improve is NOT a destination — its proposals live inside the
 *      Weekly Review.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('navbar has no psychology or improve destinations', () => {
  const nav = read('views/partials/navbar.ejs');
  assert.ok(!/href="\/psychology"/.test(nav), 'navbar must not link /psychology');
  assert.ok(!/href="\/improve"/.test(nav), 'navbar must not link /improve');
  assert.ok(/\/kaizen-ai/.test(nav), 'navbar still links KAIZEN AI');
  assert.ok(/\/weekly-summary/.test(nav), 'navbar still links the Weekly Review');
});

test('the chart sidebar lost the improve link too', () => {
  const chart = read('views/chart.ejs');
  assert.ok(!/href="\/improve"/.test(chart), 'chart sidebar must not link /improve');
});

test('the separate pages and controllers are gone', () => {
  for (const gone of [
    'views/psychology.ejs',
    'views/improve.ejs',
    'controllers/psychController.js',
    'controllers/improveController.js'
  ]) {
    assert.ok(!fs.existsSync(path.join(ROOT, gone)), gone + ' should be removed');
  }
});

test('no page still routes users to the old destinations', () => {
  const views = fs.readdirSync(path.join(ROOT, 'views'));
  for (const file of views) {
    if (!file.endsWith('.ejs')) continue;
    const body = read(path.join('views', file));
    assert.ok(!/href="\/psychology"/.test(body), file + ' links /psychology');
    assert.ok(!/href="\/improve"/.test(body), file + ' links /improve');
  }
});

test('dictionary keys follow the merge', () => {
  const { t, dictionaries } = require('../config/locales');
  assert.strictEqual(dictionaries.en['nav.psychology'], undefined, 'nav.psychology removed');
  assert.strictEqual(t('en', 'nav.weekly'), 'Weekly Review');
  assert.strictEqual(t('en', 'weekly.title'), 'Weekly Review');
});

test('KAIZEN AI carries the merged identity line', () => {
  const sub = require('../config/locales').dictionaries.en['ai.sub'];
  assert.match(sub, /your trades, your emotions, and the patterns connecting both/i);
});

test('trade coach is one room — no psychology-room routing, five layers present', () => {
  const tradeCoach = require('../services/tradeCoach');
  const prompt = tradeCoach.buildSystemPrompt({
    user: { username: 'Kai' },
    system: null,
    sessions: [],
    mindState: { themes: [{ name: 'Greed after wins', status: 'active', note: '' }] }
  });
  assert.ok(!/Psychology room/.test(prompt), 'prompt must not send anyone away');
  assert.match(prompt, /ONE ROOM, FIVE LAYERS/);
  assert.match(prompt, /trade outcomes/);
  assert.match(prompt, /emotional triggers/);
  assert.match(prompt, /behavioral mistakes/);
  assert.match(prompt, /recurring patterns/);
  assert.match(prompt, /improvement action/);
  assert.match(prompt, /Greed after wins/, 'their patterns are context');
  assert.match(prompt, /you don't predict markets/i, 'boundary intact');
});

test('weekly view renders the proposals section (the merged Improve page)', () => {
  const view = read('views/weekly-summary.ejs');
  assert.match(view, /t\('improve\.h1'\)/);
  assert.match(view, /t\('improve\.proposal'\)/);
  assert.match(view, /rec\.items/);
});
