/*
 * Best-effort text minimisation before AI requests. This is not an
 * anonymisation guarantee: free-form personal or sensitive information can
 * remain. Images are deliberately unchanged and must be treated separately.
 */
const { randomBytes } = require('crypto');
const MASK = '[removed]';
const GENERIC_USERNAMES = new Set(['trader', 'trade', 'kaizen', 'user', 'admin', 'market', 'forex', 'test']);

function identitiesForUser(user) {
  if (!user) return [];
  const values = [];
  const name = typeof user.username === 'string' ? user.username.trim() : '';
  // Very short, numeric-only and generic usernames can be ordinary trading
  // terms or values. They are omitted from prompts explicitly at source.
  if (name.length >= 3 && name.length <= 100 && /[a-z]/i.test(name) && !GENERIC_USERNAMES.has(name.toLowerCase())) values.push(name);
  if (typeof user.email === 'string' && user.email.trim()) values.push(user.email.trim());
  return values;
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function validCard(value) {
  if (!/^[\d -]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || /^([0-9])\1+$/.test(digits)) return false;
  let sum = 0, double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit; double = !double;
  }
  return sum % 10 === 0;
}

function sanitizeText(input, identities = [], hide = () => MASK) {
  let text = String(input == null ? '' : input);
  // Labelled credentials and account numbers. Avoid consuming other lines or
  // ordinary prose; unlabelled or unconventional values can still be missed.
  text = text.replace(/\b((?:(?:broker|trading|bank|investor|mt4|mt5)[ \t]+)?(?:account|acct)[ \t]+(?:number|no\.?|id|#)[ \t]*(?:[:=#]|\bis\b)?[ \t]*)([A-Za-z0-9][A-Za-z0-9_-]{3,})/gi, (m, label, value) => label + hide(value, false));
  text = text.replace(/\b((?:(?:broker|trading|bank|investor|mt4|mt5)[ \t]+)?(?:account|acct)[ \t]*(?:[:=#]|\bis\b)[ \t]*)([A-Za-z0-9][A-Za-z0-9_-]{3,})/gi, (m, label, value) => label + hide(value, false));
  text = text.replace(/\b((?:seed|recovery)[ _-]?phrase[ \t]*(?:[:=]|\bis\b)[ \t]*)([^\n;.!?]+)/gi, (m, label, value) => label + hide(value, true));
  text = text.replace(/\b((?:password|passcode|pin|api[ _-]?key|secret[ _-]?key|private[ _-]?key|access[ _-]?token)[ \t]*(?:[:=]|\bis\b)[ \t]*)([^\s,;]+)/gi, (m, label, value) => label + hide(value, true));
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, m => hide(m, false));
  text = text.replace(/\b((?:[Mm]y name is|[Ff]ull name:|[Nn]ame:)[ \t]*)(\p{Lu}[\p{L}'’-]*(?:[ \t]+\p{Lu}[\p{L}'’-]*)?)/gu, (m, label, value) => label + (value.toLowerCase() === 'trader' ? value : hide(value, false)));
  text = text.replace(/\b0x[a-fA-F0-9]{40}\b/g, m => hide(m, false));
  text = text.replace(/(?<![\w.\d])0[789][01]\d{8}(?![\w\d]|\.\d)/g, m => hide(m, false));
  // International numbers only, plus explicitly labelled local phone numbers.
  text = text.replace(/(?:^|(?<=[^\w]))\+\d(?:[\d ()-]{6,}\d)/g, m => m.replace(/\D/g, '').length >= 10 ? hide(m, false) : m);
  text = text.replace(/\b((?:phone|telephone|mobile|tel)(?:[ \t]+(?:number|no\.?))?[ \t]*(?:[:=#]|\bis\b)[ \t]*)(\+?\d[\d ()-]{6,}\d)/gi, (m, label, value) => value.replace(/\D/g, '').length >= 7 ? label + hide(value, false) : m);
  // Mask only Luhn-valid 13–19 digit sequences, not prices or ordinary ratios.
  text = text.replace(/(?<![\w.\d])(?:\d[ -]?){12,18}\d(?![\w\d]|\.\d)/g, m => validCard(m) ? hide(m, true) : m);
  for (const identity of identities) {
    if (typeof identity !== 'string' || !identity || identity.length > 200) continue;
    const pattern = new RegExp('(?<![\\p{L}\\p{N}_])' + escapeRegex(identity) + '(?![\\p{L}\\p{N}_])', 'giu');
    text = text.replace(pattern, m => hide(m, false));
  }
  return text;
}

function sanitizeContent(content, identities = [], hide = () => MASK) {
  if (typeof content === 'string') return sanitizeText(content, identities, hide);
  if (!Array.isArray(content)) return content;
  return content.map(part => part && part.type === 'text' && typeof part.text === 'string'
    ? { ...part, text: sanitizeText(part.text, identities, hide) } : part);
}

// Each request has its own unpredictable markers and in-memory map. Secrets
// and payment cards intentionally have no mapping and cannot be restored.
function createContext(user) {
  const identities = identitiesForUser(user);
  const prefix = '[[KZ_' + randomBytes(16).toString('hex') + '_';
  const byValue = new Map();
  const byMarker = new Map();
  const blocked = new Set();
  const permanentValues = new Set();
  let counter = 0;
  function hide(value, permanent) {
    const key = value.toLowerCase();
    if (permanent || validCard(value)) {
      permanentValues.add(key);
      for (const [knownValue, marker] of byValue) {
        if (knownValue.toLowerCase() === key) {
          blocked.add(marker);
          byValue.delete(knownValue);
          byMarker.delete(marker);
        }
      }
      return MASK;
    }
    if (permanentValues.has(key)) return MASK;
    if (!byValue.has(value)) {
      const marker = prefix + (++counter) + ']]';
      byValue.set(value, marker);
      byMarker.set(marker, value);
    }
    return byValue.get(value);
  }
  function restore(text) {
    let result = String(text || '');
    for (const [marker, value] of byMarker) result = result.split(marker).join(value);
    for (const marker of blocked) result = result.split(marker).join(MASK);
    return result;
  }
  function createRestorer() {
    let buffer = '';
    const markers = [...byMarker.keys(), ...blocked];
    return {
      push(chunk) {
        buffer += chunk;
        let keep = 0;
        for (const marker of markers) {
          for (let i = Math.min(marker.length - 1, buffer.length); i > keep; i--) {
            if (buffer.endsWith(marker.slice(0, i))) { keep = i; break; }
          }
        }
        const ready = keep ? buffer.slice(0, -keep) : buffer;
        buffer = keep ? buffer.slice(-keep) : '';
        return restore(ready);
      },
      flush() {
        // A truncated marker is not meaningful to a trader.
        const result = buffer && markers.some(marker => marker.startsWith(buffer)) ? MASK : restore(buffer);
        buffer = '';
        return result;
      }
    };
  }
  return {
    text: text => sanitizeText(text, identities, hide),
    content: content => sanitizeContent(content, identities, hide),
    instruction: () => byMarker.size ? '\n\nPrivacy markers such as [[KZ_...]] stand for hidden details. If you refer to one, copy it exactly as provided; do not guess its value.' : '',
    restore,
    createRestorer
  };
}

module.exports = { sanitizeText, sanitizeContent, identitiesForUser, createContext };
