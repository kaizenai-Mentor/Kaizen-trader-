/**
 * Live-journey test — the WHOLE loop against a real database, plus
 * whole-site language assertions under auth (owner directive).
 *
 * Gated on TEST_MONGODB_URI (a throwaway database — the journey creates
 * real users and sessions). The suite self-skips without it: the merge
 * gate is `npm test` = 128 pass + 1 skip. Render deploys need nothing.
 *
 * Safety (enforced below): the test REFUSES to run against a URI equal
 * to the production MONGODB_URI.
 */
const test = require('node:test');
const assert = require('node:assert');

const TEST_URI = process.env.TEST_MONGODB_URI || '';
const PROD_URI = process.env.MONGODB_URI || '';

test('journey test refuses to run against the production database', () => {
  if (TEST_URI && PROD_URI && TEST_URI === PROD_URI) {
    assert.fail('TEST_MONGODB_URI must NOT be the production MONGODB_URI');
  }
  assert.ok(true);
});

test('whole-site journey: register → plan(custom risk) → record(screenshot) → detail → five languages', {
  skip: TEST_URI ? false : 'TEST_MONGODB_URI not set (throwaway DB required)'
}, async (t) => {
  assert.notStrictEqual(TEST_URI, PROD_URI, 'refusing production database');

  process.env.MONGODB_URI = TEST_URI;
  process.env.PORT = '0';
  const mongoose = require('mongoose');
  const app = require('../server');
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const jar = new Map();
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ');
  const absorb = (res) => {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of raw) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  };

  try {
    // REGISTER (with the French picker active at signup)
    let res = await fetch(base + '/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'kaizen_lang=fr' },
      body: new URLSearchParams({
        username: 'journey_trader', email: 'journey@example.com',
        password: 'secret123', confirmPassword: 'secret123', terms: '1'
      }),
      redirect: 'manual'
    });
    absorb(res);
    assert.ok([302, 301].includes(res.status), 'register failed: ' + res.status);

    // PLAN with the custom-risk reveal box
    res = await fetch(base + '/dashboard/sessions/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader() },
      body: new URLSearchParams({
        sessionType: 'LIVE', setup: 'Sweep + MSS',
        entryCondition: '4H sweep then 15m MSS', invalidation: 'Below sweep low',
        predefinedRisk: 'CUSTOM', customRisk: '0.5%',
        emotionalState: 'Calm', confidence: '8'
      }),
      redirect: 'manual'
    });
    absorb(res);
    const recordUrl = res.headers.get('location') || '';
    assert.match(recordUrl, /\/record$/, 'plan did not route to record stage');
    const sessionId = recordUrl.split('/').filter(Boolean).slice(-2)[0];

    // RECORD with a screenshot (1x1 PNG)
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const form = new FormData();
    form.set('notes', 'Waited for the sweep. Entered on MSS. Held the plan.');
    form.set('outcome', 'Win');
    form.set('chartImage', new Blob([png], { type: 'image/png' }), 'chart.png');
    res = await fetch(base + '/dashboard/sessions/' + sessionId + '/record', {
      method: 'POST', headers: { cookie: cookieHeader() }, body: form, redirect: 'manual'
    });
    absorb(res);

    // REFLECT
    res = await fetch(base + '/dashboard/sessions/' + sessionId + '/reflect', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader() },
      body: new URLSearchParams({
        whatHappened: 'Followed the plan.', followedProcess: 'Yes.',
        learned: 'Patience pays.', wouldChange: 'Nothing.'
      }),
      redirect: 'manual'
    });
    absorb(res);

    // DETAIL: the chart is visible as THE CHART — AS RECORDED (any language
    // the picker is on — this journey registers with the French picker active)
    res = await fetch(base + '/dashboard/sessions/' + sessionId, {
      headers: { cookie: cookieHeader() }
    });
    let body = await res.text();
    const chartLabels = ['THE CHART — AS RECORDED', 'LE GRAPHIQUE — TEL QU', '图表——如记录当时', 'チャート — 記録当時のまま', 'DIE GRAFIEK — SOOS OPGETEKEN'];
    assert.ok(chartLabels.some((l) => body.includes(l)), 'chart block missing');
    assert.ok(body.includes('/chart-image'), 'chart image not wired');

    // The screenshot is served owner-only
    res = await fetch(base + '/dashboard/sessions/' + sessionId + '/chart-image', {
      headers: { cookie: cookieHeader() }
    });
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /image\/png/);

    // WHOLE-SITE LANGUAGE under auth: the five dictionaries actually render
    for (const [lang, marker] of [['en', 'Cockpit'], ['fr', 'Cockpit'], ['zh', '驾驶舱'], ['ja', 'コックピット'], ['af', 'Kajuit']]) {
      res = await fetch(base + '/dashboard', {
        headers: { cookie: cookieHeader() + '; kaizen_lang=' + lang }
      });
      body = await res.text();
      assert.ok(body.includes(marker), 'dashboard chrome not in ' + lang);
    }
  } finally {
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
