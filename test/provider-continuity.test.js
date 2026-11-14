const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const llm = require('../services/llm');
const coach = require('../services/aiCoach');
const email = require('../config/email');
const alerts = require('../services/providerAlerts');

const envNames = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_BASE_URL', 'GEMINI_BASE_URL', 'OPENROUTER_BASE_URL', 'AI_ALERT_EMAIL', 'RESEND_API_KEY'];
const originalEnv = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
for (const k of envNames) delete process.env[k];
test.after(() => { for (const k of envNames) originalEnv[k] === undefined ? delete process.env[k] : process.env[k] = originalEnv[k]; });
function server(handler) {
  return new Promise(resolve => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ s, url: 'http://127.0.0.1:' + s.address().port }));
  });
}

test('failed and interrupted Claude requests retry Gemini and new requests prefer Claude again', async t => {
  let claudeHealthy = false, anthropicHits = 0, geminiHits = 0;
  const a = await server((req, res) => {
    anthropicHits++;
    req.resume();
    req.on('end', () => {
      if (!claudeHealthy) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write('{"content":[{"type":"text","text":"partial');
        setTimeout(() => res.destroy(), 5);
      } else res.end(JSON.stringify({ content: [{ type: 'text', text: 'Claude is back' }] }));
    });
  });
  const g = await server((req, res) => {
    geminiHits++;
    req.resume();
    req.on('end', () => res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Complete Gemini review' }] } }] })));
  });
  t.after(() => { a.s.close(); g.s.close(); });
  process.env.ANTHROPIC_API_KEY = 'test'; process.env.ANTHROPIC_BASE_URL = a.url;
  process.env.GEMINI_API_KEY = 'test'; process.env.GEMINI_BASE_URL = g.url;
  assert.equal(await llm.callLLM('system', 'private input'), 'Complete Gemini review');
  claudeHealthy = true;
  assert.equal(await llm.callLLM('system', 'private input'), 'Claude is back');
  assert.equal(anthropicHits, 2); assert.equal(geminiHits, 1);
});

test('session review waits for a complete provider response', async () => {
  const original = llm.callLLM;
  const originalAvailable = llm.available;
  let resolve;
  llm.available = () => true;
  llm.callLLM = () => new Promise(r => { resolve = r; });
  try {
    const stream = coach.streamAnalysis({ session: { createdAt: new Date() }, user: {}, system: {}, recentSessions: [] });
    const pending = stream.next();
    let finished = false;
    pending.then(() => { finished = true; });
    await new Promise(r => setImmediate(r));
    assert.equal(finished, false);
    resolve('Complete review');
    assert.equal((await pending).value, 'Complete review');
    assert.equal((await stream.next()).done, true);
  } finally { llm.callLLM = original; llm.available = originalAvailable; }
});

test('owner alerts are sanitized and throttled, with retries after email failure', async () => {
  const originalSend = email.sendWithResend;
  process.env.AI_ALERT_EMAIL = 'owner@example.com'; process.env.RESEND_API_KEY = 'test';
  const sent = [];
  email.sendWithResend = async (...args) => { sent.push(args); };
  try {
    alerts.providerFailed('anthropic', new Error('Anthropic HTTP 402: trader-private secret-key'));
    alerts.providerFailed('anthropic', new Error('Anthropic HTTP 402: trader-private secret-key'));
    await new Promise(r => setImmediate(r));
    assert.equal(sent.length, 1);
    assert.match(sent[0][2], /HTTP 402/);
    assert.doesNotMatch(JSON.stringify(sent), /trader-private|secret-key/);
    alerts.providerFailed('anthropic', new Error('HTTP 402'));
    await new Promise(r => setImmediate(r));
    assert.equal(sent.length, 1);
    let attempts = 0;
    email.sendWithResend = async () => { attempts++; if (attempts === 1) throw new Error('failure'); };
    alerts.providerFailed('gemini', new Error('timeout'));
    await new Promise(r => setImmediate(r));
    alerts.providerFailed('gemini', new Error('timeout'));
    await new Promise(r => setImmediate(r));
    assert.equal(attempts, 2);
  } finally { email.sendWithResend = originalSend; delete process.env.AI_ALERT_EMAIL; delete process.env.RESEND_API_KEY; }
});

test('all providers are tried in order, and empty streams fail over', async t => {
  const hits = [];
  const a = await server((req, res) => { hits.push('claude'); req.resume(); req.on('end', () => { res.writeHead(402); res.end('unavailable'); }); });
  const g = await server((req, res) => { hits.push('gemini'); req.resume(); req.on('end', () => { res.writeHead(429); res.end('limited'); }); });
  const o = await server((req, res) => { hits.push('openrouter'); req.resume(); req.on('end', () => res.end(JSON.stringify({ choices: [{ message: { content: 'Backup review' } }] }))); });
  t.after(() => { a.s.close(); g.s.close(); o.s.close(); });
  process.env.ANTHROPIC_API_KEY = 'test'; process.env.ANTHROPIC_BASE_URL = a.url;
  process.env.GEMINI_API_KEY = 'test'; process.env.GEMINI_BASE_URL = g.url;
  process.env.OPENROUTER_API_KEY = 'test'; process.env.OPENROUTER_BASE_URL = o.url;
  assert.equal(await llm.callLLM('system', 'input'), 'Backup review');
  assert.deepEqual(hits, ['claude', 'gemini', 'openrouter']);
  // A blank successful stream is not a review; it must try the next provider.
  const empty = await server((req, res) => { req.resume(); req.on('end', () => res.end()); });
  const good = await server((req, res) => { req.resume(); req.on('end', () => res.end('data: {"candidates":[{"content":{"parts":[{"text":"Fallback stream"}]}}]}\n\n')); });
  t.after(() => { empty.s.close(); good.s.close(); });
  process.env.ANTHROPIC_BASE_URL = empty.url; process.env.GEMINI_BASE_URL = good.url;
  let response = '';
  for await (const chunk of llm.streamLLM('system', 'input')) response += chunk;
  assert.equal(response, 'Fallback stream');
});
