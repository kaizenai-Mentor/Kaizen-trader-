/**
 * Locale tests — the English-only contract (owner directive, 19 Oct
 * 2026): one dictionary, `t()` as the UI string registry, no language
 * negotiation. Unknown languages normalize to English.
 */
const test = require('node:test');
const assert = require('node:assert');
const { LANGS, dictionaries, t, normalize, keySet } = require('../config/locales');

test('English is the only dictionary', () => {
  assert.deepStrictEqual(LANGS, ['en']);
  assert.deepStrictEqual(Object.keys(dictionaries), ['en']);
  assert.ok(Object.keys(dictionaries.en).length > 100, 'en dictionary too small');
});

test('no string is stored empty', () => {
  for (const [k, v] of Object.entries(dictionaries.en)) {
    assert.ok(typeof v === 'string' && v.length > 0, 'en.' + k + ' empty');
  }
});

test('t() interpolates {{params}} and falls back sanely', () => {
  assert.strictEqual(t('en', 'dash.greeting', { name: 'Ada' }), 'Welcome back, Ada');
  assert.strictEqual(t('zz', 'nav.login'), dictionaries.en['nav.login']);
  assert.strictEqual(t('fr', 'nav.login'), dictionaries.en['nav.login']);
  assert.strictEqual(t('en', 'no.such.key'), 'no.such.key');
});

test('normalize() is English-only: every input becomes en', () => {
  for (const input of ['fr', 'zh', 'ja', 'af', 'FR', 'de', '', null, undefined, 'zz']) {
    assert.strictEqual(normalize(input), 'en');
  }
});

test('keySet() lists the English registry', () => {
  assert.deepStrictEqual(keySet('en'), Object.keys(dictionaries.en));
  assert.strictEqual(keySet('fr').length, keySet('en').length);
});
