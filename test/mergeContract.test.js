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

// ── Second pass (owner directive, 20 Oct 2026 PM): the weekly review
//    carries KAIZEN-named actions and visible dates on every card. ──
test('weekly review naming is KAIZEN\'s, not generic recommendations', () => {
  const en = require('../config/locales').dictionaries.en;
  assert.strictEqual(en['improve.h1'], 'ACTIONS TO TAKE NEXT WEEK');
  assert.strictEqual(en['improve.proposal'], "KAIZEN's proposal");
});

test('every weekly card and the header carry the week dates', () => {
  const view = read('views/weekly-summary.ejs');
  assert.match(view, /t\('wk\.weekOf'\)\s*%>\s*<%= dateRange %>/, 'header week-of line');
  const chips = (view.match(/<%= dateRange %>/g) || []).length;
  assert.ok(chips >= 7, 'expected a date chip on every card, found ' + chips);
});

test('proposals no longer greet with a doubled "My proposal:"', () => {
  const improveCoach = require('../services/improveCoach');
  const fb = improveCoach.buildFallback({
    user: { username: 'Kai' }, system: null, sessions: [], movement: null, mindState: null
  });
  for (const it of fb.items) {
    assert.ok(!/^my proposal/i.test(it.proposal), 'stale prefix: ' + it.proposal.slice(0, 40));
    assert.ok(it.proposal.length > 10, 'proposal lost its text');
  }
  const parsed = improveCoach.parseRecommendations(
    '1. Title\nWHY: rules.\nPROPOSAL: My proposal: one honest week. One rule at a time.\nEXTRACTED-REC: top=risk theme=none'
  );
  assert.strictEqual(parsed.items[0].proposal, 'one honest week. One rule at a time.');
});

// ── Third pass (owner list, 20 Oct 2026 evening): spacing, asterisks,
//    My Goals, Sun–Sat weeks, minimal reflect, no community block,
//    reputation counts the right field. ──
test('templates never glue labels to their numbers', () => {
  const glueSites = [
    ['views/weekly-summary.ejs', /<%= stats\.compliant %> <%= t\('wk\.of'\)%>|<%= stats\.compliant %> <%= t\('wk\.of'\) %> <%= stats\.checked %>/],
    ['views/weekly-summary.ejs', /<%= stats\.loopCompleted %> <%= t\('wk\.throughLoop'\)/],
    ['views/dashboard.ejs', /<%= totalSessions %> <%= t\('word\.session'\)/],
    ['views/dashboard.ejs', /<%= badgeCount %> <%= t\('word\.milestone'\)/],
    ['views/reputation.ejs', /<%= t\('rep\.basedOn'\) %> <%= totalSessions \|\| 0 %>/],
    ['views/leaderboard.ejs', /<%= move\.overall\.delta %> <%= t\('prog\.in30'\)/],
    ['views/journal.ejs', /journals\.length : 0 %> <%= t\('journal\.entries'\)/],
    ['views/kaizen-ai.ejs', /<%= thr\.messageCount %> <%= t\('ai\.messageWord'\)/],
    ['views/session-detail.ejs', /<%= session\.asset %> <%= t\('detail\.closed'\)/],
    ['views/session-record.ejs', /<%= t\('record\.titlePre'\) %> <%= session\.sessionType %>/]
  ];
  for (const [file, re] of glueSites) {
    assert.match(read(file), re, file + ' glued echo pair: ' + re);
  }
});

test('reputation counts sessions with the real Journal field', () => {
  const src = read('controllers/zaController.js');
  assert.strictEqual((src.match(/countDocuments\(\{ userId: user\._id \}\)/g) || []).length, 2);
  assert.ok(!/countDocuments\(\{ user: user\._id \}\)/.test(src), 'stale field still present');
});

test('a week runs Sunday to Saturday', () => {
  const src = read('controllers/weeklyController.js');
  assert.match(src, /now\.getDate\(\) - now\.getDay\(\)/, 'backs up to Sunday');
  assert.match(src, /\$gte: weekStart, \$lt: weekEnd/, 'bounded Sun–Sat window');
  assert.match(src, /weekStart\.getDate\(\) \+ 6/, 'Saturday endpoint for display');
});

test('reflect is minimal — the what-happened card is gone', () => {
  const view = read('views/session-reflect.ejs');
  assert.ok(!/name="whatHappened"/.test(view), 'what-happened input still on the page');
  const en = require('../config/locales').dictionaries.en;
  assert.match(en['reflect.four'], /^Three short answers/);
});

test('My Progress has no leaderboard block', () => {
  const view = read('views/leaderboard.ejs');
  assert.ok(!/prog\.community/.test(view), 'community ranks still rendered');
  assert.ok(!/REGION B/.test(view), 'region B block still present');
  const en = require('../config/locales').dictionaries.en;
  assert.strictEqual(en['goals.h1'], 'My Goals');
  assert.strictEqual(en['nav.goals'], 'My Goals');
  assert.strictEqual(en['title.goals'], 'KAIZEN — My Goals');
  assert.strictEqual(en['goals.suggested'], undefined, 'stale suggestion key');
  assert.ok(!/adopt a suggestion/.test(en['goals.empty']), 'stale adopt copy');
});

test('KAIZEN replies never ship asterisks', () => {
  const cleanText = require('../services/cleanText');
  assert.strictEqual(cleanText('**Two sessions** broke ✳ a rule'), 'Two sessions broke a rule');
  const coach = read('services/tradeCoach.js');
  assert.match(coach, /reply: cleanText\(raw\)/, 'LLM reply cleaned at the source');
  const ctrl = read('controllers/kaizenAiController.js');
  assert.match(ctrl, /persist\(cleanText\(full\)\)/, 'stream persisted clean');
  assert.match(ctrl, /final: cleanText\(full\)/, 'clean final sent to the browser');
  assert.match(ctrl, /m\.role === 'kaizen' \? Object\.assign\(\{\}, m, \{ text: cleanText\(m\.text\) \}\)/,
    'stored threads cleaned on render');
  const view = read('views/kaizen-ai.ejs');
  assert.match(view, /ev\.final != null && live/, 'live bubble swaps to the clean final');
});
