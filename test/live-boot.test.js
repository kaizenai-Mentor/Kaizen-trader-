/**
 * Live-boot tests — the REAL server, REAL HTTP (owner directive:
 * the wiring layer is where launch-day bugs live). Boots the app on an
 * ephemeral port and speaks plain HTTP to it. No database needed:
 * MONGODB_URI is unset, so config/db.js skips the connection.
 */
const test = require('node:test');
const assert = require('node:assert');

process.env.PORT = '0';
const app = require('../server');

let base;
let server;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = 'http://127.0.0.1:' + server.address().port;
});

test.after(() => {
  if (server) server.close();
});

async function get(path, headers) {
  const res = await fetch(base + path, { headers: headers || {}, redirect: 'manual' });
  const body = await res.text();
  return { res, body };
}

test('the server listens and answers on a real TCP port', async () => {
  const { res } = await get('/');
  assert.strictEqual(res.status, 200);
});

test('welcome page is English-only — no language picker (19 Oct 2026)', async () => {
  const { body } = await get('/');
  assert.ok(!body.includes('lang-switch'), 'language switcher must be gone');
  assert.ok(!body.includes('Choose your language') && !body.includes('Choisissez'), 'picker label must be gone');
});

test('login page carries no picker', async () => {
  const { res, body } = await get('/auth/login');
  assert.strictEqual(res.status, 200);
  assert.ok(!body.includes('lang-switch'), 'language switcher must be gone');
});

test('register page carries no picker', async () => {
  const { res, body } = await get('/auth/register');
  assert.strictEqual(res.status, 200);
  assert.ok(!body.includes('lang-switch'), 'language switcher must be gone');
});

test('?lang=fr sets no language cookie and stays English', async () => {
  const { res, body } = await get('/?lang=fr');
  const setCookie = res.headers.get('set-cookie') || '';
  assert.ok(!/kaizen_lang/.test(setCookie), 'no sticky language cookie anymore');
  assert.ok(!body.includes('Choisissez votre langue'), 'French chrome must be gone');
});

test('stale language cookies are ignored — chrome stays English', async () => {
  const { body } = await get('/auth/login', { cookie: 'kaizen_lang=zh' });
  assert.ok(!body.includes('登录') && !body.includes('欢迎回来'), 'Chinese chrome must be gone');
});

test('news page sits behind the auth wall for anonymous visitors', async () => {
  const { res } = await get('/news', { redirect: 'manual' } && {});
  assert.ok([301, 302].includes(res.status));
  assert.match(res.headers.get('location') || '', /login/);
});

test('news template shows articles and the events card (launch-day fix contract)', async () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'views', 'news.ejs'), 'utf8');
  assert.ok(src.includes('articles'), 'articles variable not bound — the launch-day bug is back');
  assert.ok(src.includes('UPCOMING EVENTS') || src.includes("t('news.upcomingEvents')"));
  assert.ok(src.includes("t('news.noEvents')") || src.includes('weekly maintenance'));
});

test('every dropdown is branded: the global select CSS exists', async () => {
  const { body } = await get('/css/style.css');
  assert.ok(body.includes('Branded dropdowns'));
  assert.ok(body.includes('appearance: none'));
  assert.ok(body.includes('F5C518'), 'gold chevron missing');
});

test('the support form uses the branded select class', async () => {
  const { res, body } = await get('/support');
  assert.strictEqual(res.status, 200);
  assert.ok(body.includes('class="k-input"'), 'support select not branded');
  assert.ok(body.includes('Issue Type'));
});

test('anonymous reputation access redirects to login', async () => {
  const { res } = await get('/za/reputation/507f1f77bcf86cd799439011');
  assert.ok([301, 302].includes(res.status));
  assert.match(res.headers.get('location') || '', /login/);
});

test('unknown paths 404', async () => {
  const { res } = await get('/no-such-page-at-all');
  assert.strictEqual(res.status, 404);
});

// ── The 20 Oct 2026 merges: Psychology lives inside KAIZEN AI,
//    Improve lives inside the Weekly Review. Old links redirect. ──
test('old psychology URL now lands in KAIZEN AI', async () => {
  const { res } = await get('/psychology');
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.get('location'), '/kaizen-ai');
});

test('old improve URL now lands in the Weekly Review', async () => {
  const { res } = await get('/improve');
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.get('location'), '/weekly-summary');
});

test('separate shareable KAIZEN Landing Page V1 (/landing and /beta) serves Trader Development Platform wireframe & early-user pipeline (23 Oct 2026)', async () => {
  const welcome = await get('/');
  assert.strictEqual(welcome.res.status, 200);
  assert.ok(welcome.body.includes('Most traders know'), 'welcome page (/) must remain intact as the welcome page');

  const { res, body } = await get('/landing');
  assert.strictEqual(res.status, 200);
  assert.ok(body.includes('Trader Development Platform'), 'must position KAIZEN as Trader Development Platform');
  assert.ok(body.includes('Join Beta'), 'must include Join Beta primary CTA');
  assert.ok(body.includes('Built for traders committed to continuous improvement.'), 'must include hero trusted statement');
  assert.ok(body.includes('I keep breaking my rules.') && body.includes('I revenge traded.'), 'must include Section 2 problem vertical timeline');
  assert.ok(body.includes('Most trading tools analyze the market.') && body.includes('develops the trader.'), 'must include Section 6 signature quote');
  assert.ok(body.includes('Starting Trader') && body.includes('Developed Trader'), 'must include Section 7 Performance Journey');
  assert.ok(body.includes('Better Traders Aren\'t Found.') && body.includes('They\'re Built.'), 'must include Section 10 Final CTA');
  assert.ok(body.includes('action="/beta/join"'), 'must include early-user Beta pipeline form');

  const betaAlias = await get('/beta');
  assert.strictEqual(betaAlias.res.status, 200);
  assert.ok(betaAlias.body.includes('Join the KAIZEN Beta Cohort'));
});

test('Set a goal card has no metric, target, or cadence inputs and branded select assets ship (23 Oct 2026)', async () => {
  const fs = require('fs');
  const path = require('path');
  const goalsEjs = fs.readFileSync(path.join(__dirname, '..', 'views', 'goals.ejs'), 'utf8');
  assert.ok(!goalsEjs.includes('name="metric"'), 'metric input must be removed from Set a goal card');
  assert.ok(!goalsEjs.includes('name="target"'), 'target input must be removed from Set a goal card');
  assert.ok(!goalsEjs.includes('name="cadence"'), 'cadence input must be removed from Set a goal card');

  const appJs = await get('/js/app.js');
  assert.strictEqual(appJs.res.status, 200);
  assert.ok(appJs.body.includes('initBrandedSelects') && appJs.body.includes('k-select-menu'), 'app.js must ship branded select dropdowns');
});

