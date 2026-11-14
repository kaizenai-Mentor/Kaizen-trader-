// Best-effort operational alerts only. Never include prompts, responses or keys.
const email = require('../config/email');
const lastSent = new Map();
const inFlight = new Set();
const INTERVAL_MS = 60 * 60 * 1000;
const names = { anthropic: 'Claude (Anthropic)', gemini: 'Gemini (Google)', openrouter: 'OpenRouter' };

function failureType(err) {
  const message = String((err && err.message) || '');
  const match = message.match(/\bHTTP (\d{3})\b/i);
  if (match) return 'HTTP ' + match[1];
  if (/timeout|timed out/i.test(message)) return 'timeout';
  return 'connection or response error';
}

function providerFailed(provider, err) {
  if (!names[provider]) return;
  const type = failureType(err);
  console.error('AI provider ' + provider + ' failed (' + type + ').');
  const to = (process.env.AI_ALERT_EMAIL || '').trim();
  if (!to || !process.env.RESEND_API_KEY) return;
  const now = Date.now();
  if (inFlight.has(provider) || (lastSent.has(provider) && now - lastSent.get(provider) < INTERVAL_MS)) return;
  inFlight.add(provider);
  const label = names[provider];
  const html = '<p>' + label + ' failed during a KAIZEN AI request (' + type + ').</p>' +
    '<p>KAIZEN will try the next configured provider when possible. Check the provider dashboard for credits, billing, rate limits and service status. A failure does not necessarily mean credits are exhausted.</p>' +
    '<p>This alert contains no trader data. Similar alerts are limited to one per provider per hour per server process.</p>';
  Promise.resolve().then(() => email.sendWithResend(to, 'KAIZEN AI provider warning: ' + label, html))
    .then(() => lastSent.set(provider, Date.now()))
    .catch(() => console.error('AI provider alert email failed. Check Resend configuration.'))
    .finally(() => inFlight.delete(provider));
}

module.exports = { providerFailed, failureType };
