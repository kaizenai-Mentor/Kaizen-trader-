/**
 * config/locales/index.js — English-only string registry.
 *
 * Owner directive, 19 Oct 2026: the product ships in English only.
 * The five-dictionary era is retired; `t()` remains as the UI string
 * registry so views keep one source of truth per string.
 *
 * CONTRACTS:
 *  - Stored VALUES stay English (journal text, rule text, DB content).
 *  - Machine blocks (EXTRACTED:, PSYCH-STATE:) stay English and
 *    parseable.
 */
const dictionaries = {
  en: require('./en')
};

const LANGS = ['en'];

function normalize() {
  return 'en';
}

/** t(_, 'nav.sessions') → string; unknown key → the key itself. */
function t(lang, key, params) {
  let s = dictionaries.en[key];
  if (s === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{{${k}}}`).join(String(v));
    }
  }
  return s;
}

function keySet() {
  return Object.keys(dictionaries.en);
}

module.exports = { LANGS, dictionaries, normalize, t, keySet };
