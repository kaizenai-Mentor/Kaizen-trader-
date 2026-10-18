/**
 * Locale tests — the five-dictionary contract (docs/I18N.md):
 * key parity across en/fr/zh/ja/af, fallbacks, interpolation.
 */
const test = require('node:test');
const assert = require('node:assert');
const { LANGS, dictionaries, t, normalize, keySet } = require('../config/locales');

test('all five dictionaries load', () => {
  assert.deepStrictEqual(LANGS, ['en', 'fr', 'zh', 'ja', 'af']);
  for (const l of LANGS) {
    assert.ok(Object.keys(dictionaries[l]).length > 100, l + ' dictionary too small');
  }
});

test('key parity: every English key exists in every language, no extras', () => {
  const en = keySet('en');
  for (const l of LANGS) {
    const ks = keySet(l);
    const missing = en.filter((k) => !ks.includes(k));
    const extra = ks.filter((k) => !en.includes(k));
    assert.deepStrictEqual(missing, [], l + ' missing keys: ' + missing.join(','));
    assert.deepStrictEqual(extra, [], l + ' extra keys: ' + extra.join(','));
  }
});

test('no dictionary stores an empty translation', () => {
  for (const l of LANGS) {
    for (const [k, v] of Object.entries(dictionaries[l])) {
      assert.ok(typeof v === 'string' && v.length > 0, l + '.' + k + ' empty');
    }
  }
});

test('t() interpolates {{params}} and falls back sanely', () => {
  assert.strictEqual(t('fr', 'dash.greeting', { name: 'Ada' }), 'Bon retour, Ada');
  assert.strictEqual(t('zz', 'nav.login'), dictionaries.en['nav.login']);
  assert.strictEqual(t('en', 'no.such.key'), 'no.such.key');
});

test('normalize maps anything to a supported language', () => {
  assert.strictEqual(normalize('FR'), 'fr');
  assert.strictEqual(normalize('zh-CN'), 'zh');
  assert.strictEqual(normalize('klingon'), 'en');
});
