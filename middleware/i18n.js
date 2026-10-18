/**
 * middleware/i18n.js — resolves the request language and exposes
 * `t()` to every view. Precedence:
 *   1. ?lang=fr (sticky — sets the cookie for next requests)
 *   2. kaizen_lang cookie
 *   3. user's preferredLang (set at registration)
 *   4. Accept-Language header
 *   5. English
 */
const { t, LANGS, normalize } = require('../config/locales');

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i > 0) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

function i18n(req, res, next) {
  const cookies = parseCookies(req);
  let lang = null;

  const q = String(req.query.lang || '').toLowerCase();
  if (LANGS.includes(q)) {
    lang = q;
    res.setHeader('Set-Cookie', `kaizen_lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`);
  } else if (LANGS.includes(cookies.kaizen_lang)) {
    lang = cookies.kaizen_lang;
  } else if (req.session && req.session.user && req.session.user.preferredLang && LANGS.includes(req.session.user.preferredLang)) {
    lang = req.session.user.preferredLang;
  } else {
    const accept = String(req.headers['accept-language'] || '').toLowerCase();
    for (const part of accept.split(',')) {
      const code = part.split(';')[0].trim().slice(0, 2);
      if (LANGS.includes(code)) { lang = code; break; }
    }
  }

  res.locals.lang = normalize(lang);
  res.locals.t = (key, params) => t(res.locals.lang, key, params);
  res.locals.langs = LANGS;
  next();
}

module.exports = i18n;
