/**
 * services/cleanText.js — strip markdown emphasis and star glyphs from
 * generated copy. The screens render plain text: asterisks never ship
 * (owner directive 20 Oct 2026).
 */
function cleanText(s) {
  return String(s == null ? '' : s)
    .replace(/[*✳✱✢✦＊]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

module.exports = cleanText;
