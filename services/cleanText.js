/**
 * services/cleanText.js — strip markdown emphasis and star glyphs from
 * generated copy while preserving paragraph breaks and breathing room.
 * Asterisks never ship (owner directive 20 Oct 2026).
 */
function cleanText(s) {
  let out = String(s == null ? '' : s)
    .replace(/\r\n/g, '\n')
    .replace(/[*✳✱✢✦＊]/g, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/,\s*,/g, ',')
    .replace(/([.!?:])\s*,/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.!?;:])/g, '$1')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If a long prose block arrives with zero paragraph breaks and 3+ sentences,
  // break every 2 sentences into its own paragraph so KAIZEN's reply is never jam-packed.
  if (out.length > 220 && !out.includes('\n')) {
    const sentences = out.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
    if (sentences && sentences.length >= 3) {
      const paras = [];
      for (let i = 0; i < sentences.length; i += 2) {
        paras.push(sentences.slice(i, i + 2).join(' ').trim());
      }
      out = paras.join('\n\n');
    }
  }

  return out;
}

module.exports = cleanText;
