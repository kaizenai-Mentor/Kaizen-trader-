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

test('Batch 11: dash-free site copy, public hero spacing, compelling KAIZEN AI card, Forex Factory news, My Progress chart panel below 5-dimension scoring, and Reputation rounded cards (26 Oct 2026)', async () => {
  const fs = require('fs');
  const path = require('path');

  // 1. Public page hero spacing (/ , /about , /services)
  const welcomeRes = await get('/');
  assert.strictEqual(welcomeRes.res.status, 200);
  assert.ok(!welcomeRes.body.includes('canprove'), 'welcome hero subtitle must not glue canprove');
  assert.ok(welcomeRes.body.includes('Your first trade on XAUUSD followed every rule in your playbook'), 'welcome KAIZEN AI card must carry compelling trader-specific response');

  const aboutRes = await get('/about');
  assert.strictEqual(aboutRes.res.status, 200);
  assert.ok(!aboutRes.body.includes('About<span class="k-gold">KAIZEN'), 'about hero h1 must have space before KAIZEN');
  assert.ok(!aboutRes.body.includes('says<b>Building</b>instead'), 'about score explanation must have spaces around Building');

  const servicesRes = await get('/services');
  assert.strictEqual(servicesRes.res.status, 200);
  assert.ok(!servicesRes.body.includes('What<span class="k-gold">KAIZEN</span>Gives'), 'services hero h1 must have spaces around KAIZEN');

  // 2. Compelling KAIZEN AI response card & matching site header logo on /landing
  const landingRes = await get('/landing');
  assert.strictEqual(landingRes.res.status, 200);
  assert.ok(landingRes.body.includes('>改 KAIZEN</a>'), 'landing page header logo must match 改 KAIZEN on the rest of the site');
  assert.ok(landingRes.body.includes('Your bias was not the problem today. Your ego after the first stop was.'), 'landing hero KAIZEN AI response must be deeply compelling');
  assert.ok(landingRes.body.includes('Read that sentence back to yourself: you did not enter because your setup was ready.'), 'landing session reflection KAIZEN AI response must speak directly to trader behavior');

  // 3. Forex Factory style market-impact news & calendar
  const { isMarketMovingArticle, buildMarketNewsFeed } = require('../services/marketNews');
  const { getActiveEvents } = require('../config/Events');
  assert.strictEqual(isMarketMovingArticle({ title: 'Federal Reserve signals rate cut after Core PCE inflation cools' }), true);
  assert.strictEqual(isMarketMovingArticle({ title: 'Local Widget Corp appoints new vice president of marketing' }), false);
  const feed = buildMarketNewsFeed([
    { title: 'Local Widget Corp appoints new vice president of marketing', description: 'Non-market fluff' },
    { title: 'ECB holds interest rates as EUR/USD tests key London liquidity level', description: 'Central bank macro catalyst' }
  ]);
  assert.ok(feed.some((a) => a.title.includes('ECB holds interest rates')), 'market-impact news must be kept');
  assert.ok(!feed.some((a) => a.title.includes('Local Widget Corp')), 'non-market fluff must be filtered out');
  const ffEvents = getActiveEvents();
  assert.ok(ffEvents.length >= 5 && ffEvents.some((e) => e.impact === 'HIGH' && e.currency === 'USD'), 'Forex Factory high-impact calendar events must be present');
  assert.ok(ffEvents.every((e) => e.dateLabel && /\b(2026|2027)\b/.test(e.dateLabel)), 'Calendar events must carry official release dateLabels');

  // 4. My Progress: 5-dimension scoring card followed by chart-like progress panel below it
  const leaderboardEjs = fs.readFileSync(path.join(__dirname, '..', 'views', 'leaderboard.ejs'), 'utf8');
  const dimCardIdx = leaderboardEjs.indexOf("t('prog.dimMove')");
  const chartPanelIdx = leaderboardEjs.indexOf('id="kaizenProgressChartPanel"');
  assert.ok(dimCardIdx > -1 && chartPanelIdx > dimCardIdx, 'Chart-like progress panel must be rendered below the 5-dimension scoring card on My Progress');
  assert.ok(leaderboardEjs.includes('chartPaneTrajectory') && leaderboardEjs.includes('chartPaneDimensions'), 'Chart panel must include trajectory and 5-dimension breakdown chart views');

  // 5. Reputation page rounded corners
  const repEjs = fs.readFileSync(path.join(__dirname, '..', 'views', 'reputation.ejs'), 'utf8');
  assert.ok(repEjs.includes('class="k-card k-card--elevated"') && repEjs.includes('border-radius:16px'), 'Reputation cards must have rounded corners matching the rest of the site');

  // 6. Session flow refinements: Reflect page without followedProcess card, Plan page custom risk/setup reveal boxes, Record page without redundant pipsGained
  const reflectEjs = fs.readFileSync(path.join(__dirname, '..', 'views', 'session-reflect.ejs'), 'utf8');
  assert.ok(!reflectEjs.includes('name="followedProcess"'), 'Reflect page must not duplicate "Did you follow your process?" card');

  const planEjs = fs.readFileSync(path.join(__dirname, '..', 'views', 'session-plan.ejs'), 'utf8');
  assert.ok(planEjs.includes('id="risk-custom-box"') && planEjs.includes('name="customRisk"'), 'Plan page must include automatic custom risk input box below predefinedRisk');
  assert.ok(!planEjs.includes('plan.riskDifferent'), 'Plan page must not have a dead "Different this time" option that fails to open the input box');
  assert.ok(planEjs.includes('id="setup-custom-box"') && planEjs.includes('name="customSetup"'), 'Plan page must include automatic custom setup input box below setup select');

  const recordEjs = fs.readFileSync(path.join(__dirname, '..', 'views', 'session-record.ejs'), 'utf8');
  assert.ok(recordEjs.includes('name="rrAchieved"'), 'Record page must keep R Achieved input');
  assert.ok(!recordEjs.includes('name="pipsGained"'), 'Record page must remove redundant Pips input');
  assert.ok(recordEjs.includes('id="record-actual-risk-box"') && recordEjs.includes('name="actualRisk"'), 'Record page must reveal exact risk input box when respectedRisk is NO');
  assert.ok(recordEjs.includes('name="chartImage"') && recordEjs.includes('multiple'), 'Record page must allow selecting multiple chart images');

  // 7. Cockpit % sign on overall score and 5 dimensions
  const dashEjs = fs.readFileSync(path.join(__dirname, '..', 'views', 'dashboard.ejs'), 'utf8');
  assert.ok(dashEjs.includes('<%= score.overall %>%') && dashEjs.includes('<%= d.score %>%'), 'Cockpit must display % sign on overall score and dimension meters');

  // 8. 1-to-1 Broker Trade Verification (one MT5 tradeHash cannot verify two sessions)
  const { parseBrokerStatement, matchSessionWithBrokerHistory } = require('../services/brokerVerify');
  const mt5Log = "2026.11.09 14:22:10.415 Trades '8091234': instant sell 0.50 XAUUSD at 2684.50 sl: 2692.00 tp: 2665.00";
  const parsedTrades = parseBrokerStatement(mt5Log);
  assert.strictEqual(parsedTrades.length, 1);
  const usedHashes = new Set();
  const sess1 = { sessionType: 'LIVE', asset: 'XAUUSD', notes: 'Took XAUUSD sell at London open.', createdAt: new Date('2026-11-09T15:00:00Z') };
  const sess2 = { sessionType: 'LIVE', asset: 'XAUUSD', notes: 'Another XAUUSD sell session later.', createdAt: new Date('2026-11-09T18:00:00Z') };
  const m1 = matchSessionWithBrokerHistory(sess1, parsedTrades, null, usedHashes);
  const m2 = matchSessionWithBrokerHistory(sess2, parsedTrades, null, usedHashes);
  assert.strictEqual(m1.verified, true, 'First session matching the MT5 trade must be verified');
  assert.strictEqual(m2.verified, false, 'Second session must NOT reuse the already-claimed MT5 trade');

  // 9. Personalized Scoring Engine reasons + STUDY session check isolation
  const { computeScore } = require('../services/scoreEngine');
  const personalSessions = [
    {
      _id: 's1',
      sessionType: 'LIVE',
      state: 'ANALYZED',
      asset: 'XAUUSD',
      plan: { setup: 'London Sweep', entryCondition: '15m MSS after Asian high sweep', skipped: false },
      quickChecks: { followedPlan: 'YES', withinEntryCriteria: 'YES', respectedRisk: 'YES' },
      ruleCompliance: true,
      outcome: 'Win',
      notes: 'Waited patiently for the London Sweep on XAUUSD and sized at 1% risk.',
      reflection: { learned: 'Waiting for the 15m candle close kept my entry clean.' },
      createdAt: new Date('2026-11-08T10:00:00Z')
    },
    {
      _id: 's2',
      sessionType: 'STUDY',
      state: 'ANALYZED',
      asset: 'EURUSD',
      plan: { skipped: true },
      quickChecks: { followedPlan: 'NOT_MENTIONED', withinEntryCriteria: 'NOT_MENTIONED', respectedRisk: 'NOT_MENTIONED' },
      ruleCompliance: true,
      outcome: 'No Trade',
      notes: 'Pure chart study marking out higher-timeframe liquidity zones on EURUSD.',
      reflection: { learned: 'Mapped weekly dealing ranges before Tuesday session.' },
      createdAt: new Date('2026-11-09T10:00:00Z')
    }
  ];
  const scored = computeScore(personalSessions, { riskRules: { riskPerTrade: '1%', maxDailyTrades: 3 } }, null);
  assert.ok(scored.dimensions.process.reasons[0].includes('XAUUSD') && scored.dimensions.process.reasons[0].includes('London Sweep'), 'Process reason[0] must be personalized with trader pair and setup');
  assert.strictEqual(scored.dimensions.process.score, 100, 'STUDY session with skipped trade plan must not penalize live Process score');

  // 10. Multi-Timeframe Progress Chart (1D · 1W · 1M · 1Y)
  assert.ok(
    leaderboardEjs.includes('data-tf="daily"') &&
    leaderboardEjs.includes('data-tf="weekly"') &&
    leaderboardEjs.includes('data-tf="monthly"') &&
    leaderboardEjs.includes('data-tf="yearly"'),
    'My Progress chart must include Daily, Weekly, Monthly, and Yearly timeframe buttons'
  );

  // 11. Cross-Surface Session Recall on Goals Page
  const goalCoach = require('../services/goalCoach');
  const goalGuidance = goalCoach.guide({
    goal: { title: 'Execute only confirmed London Sweep setups', metric: 'RULE_COMPLIANCE', target: 90, unit: '%', status: 'ACTIVE', rationale: 'Stop entering early' },
    user: { username: 'Dennis' },
    sessions: personalSessions
  });
  assert.ok(goalGuidance.sessionVerdict && goalGuidance.sessionVerdict.includes('XAUUSD'), 'Goal guidance sessionVerdict must recall the trader actual logged session pair and text');
  assert.ok(goalGuidance.doingWell.includes('XAUUSD'), 'Goal doingWell must recall the trader compliant session');
});



test('Google sign-in without configuration reports the problem on registration', async () => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return;
  const start = await get('/auth/google?from=register');
  assert.strictEqual(start.res.headers.get('location'), '/auth/register?google=unavailable');
  const result = await get('/auth/register?google=unavailable');
  assert.ok(result.body.includes('Google sign-in is not configured here'));
});
