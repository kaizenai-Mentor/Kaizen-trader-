/**
 * LLM provider layer tests — services/llm.js.
 *
 * Covers: provider priority, content normalization, payload shapes for all
 * three providers, SSE parsing, tail holdback (EXTRACTED / PSYCH-STATE),
 * and real HTTP round-trips against a local fake provider (no real keys,
 * no network — the base-URL override points the adapters at 127.0.0.1).
 */
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const llm = require('../services/llm');

// ── env helpers ────────────────────────────────────────────────────
const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY',
  'ANTHROPIC_BASE_URL', 'GEMINI_BASE_URL', 'OPENROUTER_BASE_URL',
  'GEMINI_MODEL', 'OPENROUTER_MODEL', 'ANTHROPIC_MODEL'];
const saved = {};
for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }

function restore() { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }

test.after(() => restore());

test('provider priority: anthropic first, then gemini, then openrouter', (t) => {
  t.after(() => { for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY']) delete process.env[k]; });
  assert.strictEqual(llm.activeProvider(), null, 'no keys -> null');
  assert.strictEqual(llm.available(), false);
  process.env.OPENROUTER_API_KEY = 'k';
  assert.strictEqual(llm.activeProvider(), 'openrouter');
  process.env.GEMINI_API_KEY = 'k';
  assert.strictEqual(llm.activeProvider(), 'gemini');
  process.env.ANTHROPIC_API_KEY = 'k';
  assert.strictEqual(llm.activeProvider(), 'anthropic');
});

test('normalizeContent: string, mixed parts, and Anthropic-shaped images', () => {
  assert.deepStrictEqual(llm.normalizeContent('hello'), { text: 'hello', images: [] });
  const n = llm.normalizeContent([
    { type: 'text', text: 'a' },
    { type: 'image', dataUrl: 'data:image/png;base64,QUJD' },
    { type: 'text', text: 'b' },
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'WFla' } }
  ]);
  assert.strictEqual(n.text, 'a\n\nb');
  assert.strictEqual(n.images.length, 2);
  assert.strictEqual(n.images[0].mimeType, 'image/png');
  assert.strictEqual(n.images[1].base64, 'WFla');
});

test('payload builders carry system, content, and images for each provider', () => {
  const norm = { text: 'hi', images: [{ mimeType: 'image/png', base64: 'QUJD', dataUrl: 'data:image/png;base64,QUJD' }] };
  const a = JSON.parse(llm._internal.anthropicPayload('SYS', norm, 500, false));
  assert.strictEqual(a.system, 'SYS');
  assert.strictEqual(a.max_tokens, 500);
  assert.deepStrictEqual(a.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } });

  const g = JSON.parse(llm._internal.geminiPayload('SYS', norm, 500));
  assert.strictEqual(g.systemInstruction.parts[0].text, 'SYS');
  assert.deepStrictEqual(g.contents[0].parts[0], { inlineData: { mimeType: 'image/png', data: 'QUJD' } });

  const o = JSON.parse(llm._internal.openrouterPayload('SYS', norm, 500, true));
  assert.strictEqual(o.messages[0].role, 'system');
  assert.strictEqual(o.stream, true);
  assert.deepStrictEqual(o.messages[1].content[1], { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } });
});

test('SSE parser handles split lines, multiple events, and CRLF', () => {
  const events = [];
  const feed = llm.makeSSEParser((d) => events.push(d));
  feed('data: {"a":1}\n');
  feed('data: {"b"');
  feed(':2}\ndata: [DONE]\r\n\r\n');
  assert.deepStrictEqual(events, ['{"a":1}', '{"b":2}', '[DONE]']);
});

test('tail holdback hides a marker — whole, split across chunks, and absent', () => {
  // whole
  let h = llm.createTailHoldback('EXTRACTED:');
  assert.strictEqual(h.push('Good work.\nEXTRACTED: outcome=Win'), 'Good work.\n');
  assert.strictEqual(h.push(' more tail'), '');
  assert.deepStrictEqual(h.flush(), { rest: '', tail: 'EXTRACTED: outcome=Win more tail', tailFound: true });

  // split across chunks
  h = llm.createTailHoldback('EXTRACTED:');
  assert.strictEqual(h.push('Part one. EXTRA'), 'Part one. ');
  assert.strictEqual(h.push('CTED: outcome=Loss'), '');
  assert.strictEqual(h.push(' tail'), '');
  const f2 = h.flush();
  assert.strictEqual(f2.tailFound, true);
  assert.match(f2.tail, /^EXTRACTED: outcome=Loss tail$/);

  // absent
  h = llm.createTailHoldback('PSYCH-STATE:');
  const out = h.push('Everything visible.') + h.flush().rest;
  assert.strictEqual(out, 'Everything visible.');
});

// ── live round-trips against a local fake provider ─────────────────
function fakeProvider(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

test('callLLM and streamLLM work end-to-end against the Gemini-shaped API', async () => {
  const { server, port } = await fakeProvider((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      assert.match(req.url, /^\/v1beta\/models\/gemini-2.5-flash/);
      const payload = JSON.parse(body);
      assert.strictEqual(payload.systemInstruction.parts[0].text, 'SYS');
      if (req.url.includes(':generateContent')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'FULL REPLY' }] } }] }));
      } else {
        // streaming: SSE with one event split across two writes
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: {"candidates":[{"content":{"parts":[{"text":"STR"}]}}]}\n');
        setTimeout(() => {
          res.write('data: {"candidates":[{"content":{"parts":[{"text":"EAM"}]}}]}\n\n');
          res.end();
        }, 30);
      }
    });
  });
  delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENROUTER_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_BASE_URL = 'http://127.0.0.1:' + port;
  try {
    const text = await llm.callLLM('SYS', 'hello');
    assert.strictEqual(text, 'FULL REPLY');

    let streamed = '';
    for await (const chunk of llm.streamLLM('SYS', 'hello')) streamed += chunk;
    assert.strictEqual(streamed, 'STREAM');
  } finally {
    server.close();
  }
});

test('callLLM fails over to the next provider when the first fails', async () => {
  let anthropumHits = 0;
  const { server: bad, port: badPort } = await fakeProvider((req, res) => {
    anthropumHits++;
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"boom"}');
  });
  const { server: good, port: goodPort } = await fakeProvider((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'GEMINI SAVED THE DAY' }] } }] }));
    });
  });
  delete process.env.OPENROUTER_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'k';
  process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:' + badPort;
  process.env.GEMINI_API_KEY = 'k';
  process.env.GEMINI_BASE_URL = 'http://127.0.0.1:' + goodPort;
  try {
    const text = await llm.callLLM('SYS', 'hello');
    assert.strictEqual(anthropumHits, 1, 'first provider was tried');
    assert.strictEqual(text, 'GEMINI SAVED THE DAY');
  } finally {
    bad.close();
    good.close();
  }
});

test('openrouter adapter round-trip (non-stream + stream)', async () => {
  const { server, port } = await fakeProvider((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      assert.strictEqual(req.url, '/api/v1/chat/completions');
      assert.strictEqual(req.headers.authorization, 'Bearer or-key');
      const payload = JSON.parse(body);
      assert.strictEqual(payload.messages[0].role, 'system');
      if (payload.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: {"choices":[{"delta":{"content":"A"}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"content":"B"}}]}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'OR FULL' } }] }));
      }
    });
  });
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.OPENROUTER_API_KEY = 'or-key';
  process.env.OPENROUTER_BASE_URL = 'http://127.0.0.1:' + port;
  try {
    assert.strictEqual(await llm.callLLM('SYS', 'hello'), 'OR FULL');
    let streamed = '';
    for await (const chunk of llm.streamLLM('SYS', 'hello')) streamed += chunk;
    assert.strictEqual(streamed, 'AB');
  } finally {
    server.close();
  }
});
