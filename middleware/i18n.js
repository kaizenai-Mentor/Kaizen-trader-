/**
 * middleware/i18n.js — English-only string access for every view.
 *
 * Owner directive, 19 Oct 2026: the product ships in English only.
 * Language negotiation (query/cookie/Accept-Language/preferredLang) is
 * removed; `t()` is always bound to the English registry.
 */
const { t, LANGS } = require('../config/locales');

function i18n(req, res, next) {
  res.locals.lang = 'en';
  res.locals.langs = LANGS;
  res.locals.t = (key, params) => t('en', key, params);
  res.locals.labels = require('../services/labels');
  next();
}

module.exports = i18n;
