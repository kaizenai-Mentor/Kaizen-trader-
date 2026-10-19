/**
 * KAIZEN docs snapshot builder (GitHub Pages review venue).
 *
 * Rebuilds the static review snapshot in docs/ from the REAL views:
 *   - 13 demo-data app pages via scripts/render-review-pages.js
 *   - 10 public pages rendered logged-out (user: null) + demo announcement
 * then copies front-end assets and rewrites links to relative .html paths so
 * the snapshot works on a GitHub Pages project site
 * (https://kaizenai-mentor.github.io/Kaizen-trader-/).
 *
 * Only *.html and asset folders inside docs/ are written. The docs/*.md
 * files, .nojekyll and manifest.json are left alone / refreshed from public/.
 *
 * Usage:  node scripts/build-docs-snapshot.js
 *         SNAP_LANG=fr SNAP_SUFFIX=-fr node scripts/build-docs-snapshot.js
 * Language runs render the same pages under SNAP_LANG and write suffixed
 * files (welcome-fr.html, …) so the GitHub Pages snapshot shows the whole
 * site in all five dictionaries.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const ejs = require(path.join(ROOT, 'node_modules', 'ejs'));
const DOCS = path.join(ROOT, 'docs');
const TMP = path.join(os.tmpdir(), 'kaizen-docs-build-' + Date.now());
const SNAP_LANG = process.env.SNAP_LANG || 'en';
const SUFFIX = process.env.SNAP_SUFFIX || '';

// Same announcement the review renderer uses (demo ticker content).
const ANNOUNCEMENT = {
  message: '<b>KAIZEN V2 IS COMING</b> — the score gets five dimensions · plan → record → reflect sessions · your own Trading System · rolling out over the next 30 days',
  messageKey: 'ticker.announce.v2'
};

// view name -> output file (public pages, rendered logged out)
const PUBLIC_PAGES = {
  welcome: 'index.html',
  about: 'about.html',
  services: 'services.html',
  help: 'help.html',
  privacy: 'privacy.html',
  terms: 'terms.html',
  support: 'support.html',
  login: 'login.html',
  register: 'register.html',
  whitepaper: 'whitepaper.html'
};

// Absolute app links -> relative snapshot pages. ORDER MATTERS:
// session stage pages must be rewritten before the generic session detail rule.
const REWRITES = [
  [/src="\/dashboard\/sessions\/[^"]*\/chart-image"/g, 'src="images/chart-demo.png"'],
  [/href="\/dashboard\/sessions\/new[^"]*"/g, 'href="session-plan.html"'],
  [/href="\/dashboard\/sessions\/[^"\/?]*\/plan[^"]*"/g, 'href="session-plan.html"'],
  [/href="\/dashboard\/sessions\/[^"\/?]*\/record[^"]*"/g, 'href="session-record.html"'],
  [/href="\/dashboard\/sessions\/[^"\/?]*\/reflect[^"]*"/g, 'href="session-reflect.html"'],
  [/href="\/dashboard\/sessions"/g, 'href="sessions.html"'],
  [/href="\/dashboard\/sessions\/[^"]*"/g, 'href="session-detail.html"'],
  [/href="\/dashboard"/g, 'href="dashboard.html"'],
  [/href="\/leaderboard"/g, 'href="leaderboard.html"'],
  [/href="\/kaizen-ai"/g, 'href="kaizen-ai.html"'],
  [/href="\/psychology"/g, 'href="psychology.html"'],
  [/href="\/memories"/g, 'href="memories.html"'],
  [/href="\/weekly-summary"/g, 'href="weekly-summary.html"'],
  [/href="\/improve"/g, 'href="improve.html"'],
  [/href="\/goals"/g, 'href="goals.html"'],
  [/href="\/za\/reputation\/[^"]*"/g, 'href="reputation.html"'],
  [/href="\/settings\/trading-system"/g, 'href="trading-system.html"'],
  [/href="\/auth\/login"/g, 'href="login.html"'],
  [/href="\/auth\/register"/g, 'href="register.html"'],
  [/href="\/auth\/logout"/g, 'href="index.html"'],
  [/href="\/support"/g, 'href="support.html"'],
  [/href="\/about"/g, 'href="about.html"'],
  [/href="\/whitepaper"/g, 'href="whitepaper.html"'],
  [/href="\/services"/g, 'href="services.html"'],
  [/href="\/help"/g, 'href="help.html"'],
  [/href="\/privacy"/g, 'href="privacy.html"'],
  [/href="\/terms"/g, 'href="terms.html"'],
  [/href="\/#([^"]*)"/g, 'href="#$1"'],
  [/href="\/"/g, 'href="index.html"'],
  [/(href|src)="\/(css|js|images)\//g, '$1="$2/'],
  [/href="\/manifest\.json"/g, 'href="manifest.json"']
];

(async () => {
  // 1. App pages (demo data) via the permanent review renderer.
  execFileSync(process.execPath, [path.join(__dirname, 'render-review-pages.js'), TMP, SNAP_LANG], { stdio: 'inherit' });

  // 2. Public pages, logged out.
  const locales = require(path.join(ROOT, 'config', 'locales'));
  for (const [view, out] of Object.entries(PUBLIC_PAGES)) {
    const html = await ejs.renderFile(path.join(ROOT, 'views', view + '.ejs'), {
      user: null,
      announcement: ANNOUNCEMENT,
      deleted: null,
      error: null,
      lang: SNAP_LANG,
      langs: locales.LANGS,
      t: (key, params) => locales.t(SNAP_LANG, key, params)
    });
    fs.writeFileSync(path.join(TMP, out), html);
    console.log('OK   ' + view + ' -> docs/' + out);
  }

  // 3. Link rewrites (GitHub Pages: everything relative).
  let count = 0;
  for (const f of fs.readdirSync(TMP)) {
    if (!f.endsWith('.html')) continue;
    let html = fs.readFileSync(path.join(TMP, f), 'utf8');
    for (const [re, to] of REWRITES) html = html.replace(re, to);
      fs.writeFileSync(path.join(DOCS, f.replace(/\.html$/, SUFFIX + '.html')), html);
    count++;
  }
  console.log('wrote ' + count + ' html pages to docs/' + (SUFFIX ? ' (lang ' + SNAP_LANG + SUFFIX + ')' : ''));

  // 4. Assets (mirror public/ front-end into docs/).
  fs.cpSync(path.join(ROOT, 'public/css'), path.join(DOCS, 'css'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'public/js'), path.join(DOCS, 'js'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'public/images'), path.join(DOCS, 'images'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'public/preview'), path.join(DOCS, 'preview'), { recursive: true });

  // Preview mockups live one level down: their /css /js /images references
  // must point up one folder, and /preview/preview.css becomes relative.
  const PREVIEW_REWRITES = [
    [/(href|src)="\/(css|js|images)\//g, '$1="../$2/'],
    [/href="\/preview\/preview\.css"/g, 'href="preview.css"']
  ];
  const previewDir = path.join(DOCS, 'preview');
  for (const f of fs.readdirSync(previewDir)) {
    if (!f.endsWith('.html')) continue;
    const p = path.join(previewDir, f);
    let html = fs.readFileSync(p, 'utf8');
    for (const [re, to] of PREVIEW_REWRITES) html = html.replace(re, to);
    fs.writeFileSync(p, html);
  }
  console.log('rewrote preview mockup asset paths');
  fs.copyFileSync(path.join(ROOT, 'public/manifest.json'), path.join(DOCS, 'manifest.json'));
  fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');

  // Language index — the entry point for reviewing the five dictionaries.
  const LANG_SET = [
    ['en', '', 'English'],
    ['fr', '-fr', 'Français'],
    ['zh', '-zh', '中文'],
    ['ja', '-ja', '日本語'],
    ['af', '-af', 'Afrikaans']
  ];
  const showcase = [
    ['index.html', 'Welcome'], ['login.html', 'Log In'], ['register.html', 'Join'],
    ['sessions.html', 'Sessions'], ['session-detail.html', 'Session detail'],
    ['news.html', 'Market News'], ['reputation.html', 'Reputation'], ['support.html', 'Support']
  ];
  const rows = LANG_SET.map(([code, sfx, name]) =>
    '<tr><td style="padding:10px 14px;border-bottom:1px solid var(--border);font-weight:600;">' + name + '</td>' +
    showcase.map(([f, label]) =>
      '<td style="padding:10px 14px;border-bottom:1px solid var(--border);"><a style="color:var(--gold);" href="' + f.replace('.html', sfx + '.html') + '">' + label + '</a></td>'
    ).join('') + '</tr>'
  ).join('');
  fs.writeFileSync(path.join(DOCS, 'languages.html'),
    '<!doctype html><html><head><meta charset="utf-8"><title>KAIZEN — Languages</title>' +
    '<link rel="stylesheet" href="css/style.css"></head><body style="background:var(--bg);color:var(--text-primary);font-family:Outfit,sans-serif;padding:40px;">' +
    '<h1 style="color:var(--gold);">改 KAIZEN — whole-site languages</h1>' +
    '<p style="color:var(--ash);max-width:640px;">Owner directive 13 Oct 2026: the entire interface in five languages. Pick any page in any language below. Stored values stay English; long-form legal/marketing prose awaits the owner-curated pass (docs/I18N.md).</p>' +
    '<table style="border-collapse:collapse;margin-top:20px;width:100%;"><thead><tr>' +
    '<th style="text-align:left;padding:10px 14px;border-bottom:2px solid var(--gold);">Language</th>' +
    showcase.map(([, label]) => '<th style="text-align:left;padding:10px 14px;border-bottom:2px solid var(--gold);color:var(--ash);font-size:0.8rem;">' + label + '</th>').join('') +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p style="margin-top:24px;"><a style="color:var(--gold);" href="index.html">← Back to the English snapshot</a></p>' +
    '</body></html>');
  console.log('wrote docs/languages.html');

  console.log('docs snapshot rebuilt (markdown docs untouched).');
})().catch(err => { console.error('BUILD FAILED:', err.message); process.exit(1); });
