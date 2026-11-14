/*
 * Best-effort text minimisation before AI requests. This is not an
 * anonymisation guarantee: free-form personal or sensitive information can
 * remain. Images are deliberately unchanged and must be treated separately.
 */
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

function sanitizeText(input, identities = []) {
  let text = String(input == null ? '' : input);
  // Labelled credentials and account numbers. Avoid consuming other lines or
  // ordinary prose; unlabelled or unconventional values can still be missed.
  text = text.replace(/\b((?:(?:broker|trading|bank|investor|mt4|mt5)[ \t]+)?(?:account|acct)[ \t]+(?:number|no\.?|id|#)[ \t]*(?:[:=#]|\bis\b)?[ \t]*)([A-Za-z0-9][A-Za-z0-9_-]{3,})/gi, '$1' + MASK);
  text = text.replace(/\b((?:(?:broker|trading|bank|investor|mt4|mt5)[ \t]+)?(?:account|acct)[ \t]*(?:[:=#]|\bis\b)[ \t]*)([A-Za-z0-9][A-Za-z0-9_-]{3,})/gi, '$1' + MASK);
  text = text.replace(/\b((?:seed|recovery)[ _-]?phrase[ \t]*(?:[:=]|\bis\b)[ \t]*)([^\n;.!?]+)/gi, '$1' + MASK);
  text = text.replace(/\b((?:password|passcode|pin|api[ _-]?key|secret[ _-]?key|private[ _-]?key|access[ _-]?token)[ \t]*(?:[:=]|\bis\b)[ \t]*)([^\s,;]+)/gi, '$1' + MASK);
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, MASK);
  text = text.replace(/\b((?:[Mm]y name is|[Ff]ull name:|[Nn]ame:)[ \t]*)(\p{Lu}[\p{L}'’-]*(?:[ \t]+\p{Lu}[\p{L}'’-]*)?)/gu, '$1' + MASK);
  text = text.replace(/\b0x[a-fA-F0-9]{40}\b/g, MASK);
  text = text.replace(/(?<![\w.\d])0[789][01]\d{8}(?![\w\d]|\.\d)/g, MASK);
  // International numbers only, plus explicitly labelled local phone numbers.
  text = text.replace(/(?:^|(?<=[^\w]))\+\d(?:[\d ()-]{6,}\d)/g, m => m.replace(/\D/g, '').length >= 10 ? MASK : m);
  text = text.replace(/\b((?:phone|telephone|mobile|tel)(?:[ \t]+(?:number|no\.?))?[ \t]*(?:[:=#]|\bis\b)[ \t]*)(\+?\d[\d ()-]{6,}\d)/gi, (m, label, value) => value.replace(/\D/g, '').length >= 7 ? label + MASK : m);
  // Mask only Luhn-valid 13–19 digit sequences, not prices or ordinary ratios.
  text = text.replace(/(?<![\w.\d])(?:\d[ -]?){12,18}\d(?![\w\d]|\.\d)/g, m => validCard(m) ? MASK : m);
  for (const identity of identities) {
    if (typeof identity !== 'string' || !identity || identity.length > 200) continue;
    const pattern = new RegExp('(?<![\\p{L}\\p{N}_])' + escapeRegex(identity) + '(?![\\p{L}\\p{N}_])', 'giu');
    text = text.replace(pattern, MASK);
  }
  return text;
}

function sanitizeContent(content, identities = []) {
  if (typeof content === 'string') return sanitizeText(content, identities);
  if (!Array.isArray(content)) return content;
  return content.map(part => part && part.type === 'text' && typeof part.text === 'string'
    ? { ...part, text: sanitizeText(part.text, identities) } : part);
}

module.exports = { sanitizeText, sanitizeContent, identitiesForUser };
