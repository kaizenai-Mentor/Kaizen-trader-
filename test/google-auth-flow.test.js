const test = require('node:test');
const assert = require('node:assert/strict');
const { googleConfig, findOrCreateGoogleUser } = require('../services/googleAuth');

const baseEnv = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', NODE_ENV: 'development', PORT: '3000' };
test('Google callback is configured explicitly or uses the local origin, not the incoming host', () => {
  assert.equal(googleConfig({}), null);
  assert.equal(googleConfig(baseEnv).callbackURL, 'http://localhost:3000/auth/google/callback');
  assert.equal(googleConfig({ ...baseEnv, APP_URL: 'https://example.com' }).callbackURL, 'https://example.com/auth/google/callback');
  assert.equal(googleConfig({ ...baseEnv, GOOGLE_CALLBACK_URL: 'http://attacker.example/auth/google/callback' }), null);
  assert.equal(googleConfig({ ...baseEnv, GOOGLE_CALLBACK_URL: 'https://example.com/auth/google/callback?x=1' }), null);
});

test('Google account creation and linking require an authenticated verified email', async () => {
  let created;
  const User = { async findOne() { return null; }, async create(data) { created = data; return data; } };
  await assert.rejects(findOrCreateGoogleUser({ id: 'g', emails: [{ value: 'user@gmail.com', verified: false }] }, User, () => {}), /verified email/);
  const user = await findOrCreateGoogleUser({ id: 'g', displayName: 'Trader Name', emails: [{ value: 'USER@gmail.com', verified: true }] }, User, () => {});
  assert.equal(user.email, 'user@gmail.com');
  assert.equal(created.googleId, 'g');
  assert.ok(created.termsAcceptedAt instanceof Date);
  const existing = { googleId: null, authMethod: 'password', async save() { this.saved = true; } };
  const ExistingUser = { async findOne(query) { return query.email ? existing : null; } };
  await findOrCreateGoogleUser({ id: 'g', emails: [{ value: 'user@gmail.com', verified: true }] }, ExistingUser, () => {});
  assert.equal(existing.googleId, 'g');
  assert.equal(existing.authMethod, 'password');
  assert.equal(existing.saved, true);
  const Other = { async findOne(query) { return query.email ? { googleId: null } : null; } };
  await assert.rejects(findOrCreateGoogleUser({ id: 'g', emails: [{ value: 'user@external.test', verified: true }] }, Other, () => {}), /verified link/);
});

test('Google route generates state and rejects a callback with an invalid state', async t => {
  Object.assign(process.env, baseEnv);
  delete process.env.MONGODB_URI;
  const app = require('../server');
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port;
  const start = await fetch(base + '/auth/google?from=register', { redirect: 'manual' });
  assert.equal(start.status, 302);
  const location = new URL(start.headers.get('location'));
  assert.equal(location.hostname, 'accounts.google.com');
  assert.equal(location.searchParams.get('redirect_uri'), 'http://localhost:3000/auth/google/callback');
  assert.ok(location.searchParams.get('state'));
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const invalid = await fetch(base + '/auth/google/callback?code=fake&state=wrong', { redirect: 'manual', headers: { cookie } });
  assert.equal(invalid.headers.get('location'), '/auth/register?google=failed');
});

test('Google callback establishes a session and routes new and returning traders correctly', async t => {
  const app = require('../server');
  const passport = require('passport');
  const TradingSystem = require('../models/TradingSystem');
  const original = passport._strategy('google');
  const findOne = TradingSystem.findOne;
  let existing = false;
  TradingSystem.findOne = async () => existing ? { userId: '123' } : null;
  const fakeUser = { id: '123', _id: '123', username: 'Trader', email: 'trader@gmail.com', tradingStyle: {} };
  const strategy = new passport.Strategy();
  strategy.name = 'google';
  strategy.authenticate = function () { this.success(fakeUser); };
  passport.use(strategy);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => { server.close(); passport.use(original); TradingSystem.findOne = findOne; });
  const base = 'http://127.0.0.1:' + server.address().port;
  const first = await fetch(base + '/auth/google/callback', { redirect: 'manual' });
  assert.equal(first.headers.get('location'), '/auth/onboarding/rules');
  assert.ok(first.headers.get('set-cookie'));
  existing = true;
  const returning = await fetch(base + '/auth/google/callback', { redirect: 'manual' });
  assert.equal(returning.headers.get('location'), '/dashboard');
});
