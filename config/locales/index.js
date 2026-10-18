/**
 * config/locales/index.js — the five dictionaries (owner directive,
 * 13 Oct 2026): English, French, Chinese (Simplified), Japanese,
 * Afrikaans. Whole-site UI strings live here.
 *
 * CONTRACTS (docs/I18N.md):
 *  - Stored VALUES stay English (journal text, rule text, DB content).
 *  - Machine blocks (EXTRACTED:, PSYCH-STATE:) stay English in every
 *    language so they remain parseable.
 *  - Long-form legal/prose pages are an owner-curated translation pass
 *    (docs/I18N.md) — titles and short copy are localized now.
 */
const dictionaries = {
  en: require('./en'),
  fr: require('./fr'),
  zh: require('./zh'),
  ja: require('./ja'),
  af: require('./af')
};

const LANGS = ['en', 'fr', 'zh', 'ja', 'af'];

function normalize(lang) {
  const l = String(lang || '').toLowerCase().slice(0, 2);
  return LANGS.includes(l) ? l : 'en';
}

/** t('fr', 'nav.sessions') → string; unknown key → en fallback → key itself. */
function t(lang, key, params) {
  const l = normalize(lang);
  let s = dictionaries[l][key];
  if (s === undefined) s = dictionaries.en[key];
  if (s === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{{${k}}}`).join(String(v));
    }
  }
  return s;
}

/** Every key present in English must exist in every dictionary (tested). */
function keySet(lang) {
  return Object.keys(dictionaries[normalize(lang)]);
}

module.exports = { LANGS, dictionaries, normalize, t, keySet };
