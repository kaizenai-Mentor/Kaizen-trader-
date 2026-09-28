/**
 * Auth tests — the terms-consent hard gate (owner directive 18 Sep 2026):
 * no account is created until the Terms/Privacy checkbox is ticked.
 * No DB needed: the gate runs before any database write, which these tests
 * also prove (User.findOne is booby-trapped in the rejection case).
 */
const test = require('node:test');
const assert = require('node:assert');
const User = require('../models/User');
const { postRegister } = require('../controllers/authController');

const VALID_BODY = {
  username: 'kaizen_trader',
  email: 'kaizen@example.com',
  password: 'secret123',
  confirmPassword: 'secret123'
};

function captureRender() {
  const captured = {};
  return {
    res: { render: (view, opts) => { captured.view = view; captured.opts = opts; } },
    captured
  };
}

test('registration is rejected when the terms box is not ticked', async () => {
  const original = User.findOne;
  let dbTouched = false;
  User.findOne = async () => { dbTouched = true; throw new Error('DB must not be touched before consent'); };

  const { res, captured } = captureRender();
  try {
    await postRegister({ body: { ...VALID_BODY }, session: {} }, res);
  } finally {
    User.findOne = original;
  }

  assert.strictEqual(dbTouched, false, 'gate must run before any database write');
  assert.strictEqual(captured.view, 'register');
  assert.strictEqual(captured.opts.step, 'join');
  assert.match(captured.opts.error, /Terms of Service and Privacy Policy/);
  // typed values survive the re-render
  assert.strictEqual(captured.opts.username, 'kaizen_trader');
  assert.strictEqual(captured.opts.email, 'kaizen@example.com');
});

test('a tampered terms value (not "1") is also rejected', async () => {
  const original = User.findOne;
  User.findOne = async () => { throw new Error('DB must not be touched'); };
  const { res, captured } = captureRender();
  try {
    await postRegister({ body: { ...VALID_BODY, terms: 'yes' }, session: {} }, res);
  } finally {
    User.findOne = original;
  }
  assert.match(captured.opts.error, /Terms of Service and Privacy Policy/);
});

test('terms ticked ("1") passes the gate and proceeds to the existing-user lookup', async () => {
  const original = User.findOne;
  let lookedUp = false;
  User.findOne = async () => { lookedUp = true; return { _id: 'existing' }; };
  const { res, captured } = captureRender();
  try {
    await postRegister({ body: { ...VALID_BODY, terms: '1' }, session: {} }, res);
  } finally {
    User.findOne = original;
  }
  assert.strictEqual(lookedUp, true, 'consent given: flow continues normally');
  assert.match(captured.opts.error, /already taken/);
});
