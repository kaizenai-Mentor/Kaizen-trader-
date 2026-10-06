/**
 * services/llm.js — one door for every AI provider (owner directive
 * 18 Sep 2026: Gemini + OpenRouter keys for response generation and
 * streaming, alongside Anthropic).
 *
 * PRIORITY: ANTHROPIC_API_KEY → GEMINI_API_KEY → OPENROUTER_API_KEY.
 * The first key found wins; if a call fails, the next configured provider
 * takes over (and for streams: only if nothing was emitted yet).
 *
 * EVERY SURFACE GOES THROUGH HERE: aiCoach (session analysis, weekly
 * letter), tradeCoach (KAIZEN AI chat), psychCoach (Psychology chat).
 * The coaching contracts (never a score, never a signal, deterministic
 * fallback without any key) live in those services — this file only
 * transports prompts and text.
 *
 * API:
 *   available()                  → any provider key configured?
 *   activeProvider()             → 'anthropic' | 'gemini' | 'openrouter' | null
 *   callLLM(system, content, o)  → full text (tries each provider in order)
 *   streamLLM(system, content, o)→ async generator of text chunks
 *   createTailHoldback(marker)   → hides a trailing marker block (EXTRACTED:,
 *                                  PSYCH-STATE:) while streaming to the user
 *
 * Content: a plain string, or an array of parts:
 *   [{ type: 'text', text }, { type: 'image', dataUrl: 'data:image/png;base64,…' }]
 *
 * Base-URL overrides (testing, proxies, restricted networks):
 *   ANTHROPIC_BASE_URL / GEMINI_BASE_URL / OPENROUTER_BASE_URL
 */

const https = require('https');

// ── Provider configuration ─────────────────────────────────────────

const PROVIDERS = [
  {
    name: 'anthropic',
    keyEnv: 'ANTHROPIC_API_KEY',
    baseUrlEnv: 'ANTHROPIC_BASE_URL',
    defaultBase: 'https://api.anthropic.com',
    modelEnv: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-3-5-sonnet-20241022'
  },
  {
    name: 'gemini',
    keyEnv: 'GEMINI_API_KEY',
    baseUrlEnv: 'GEMINI_BASE_URL',
    defaultBase: 'https://generativelanguage.googleapis.com',
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-2.5-flash'
  },
  {
    name: 'openrouter',
    keyEnv: 'OPENROUTER_API_KEY',
    baseUrlEnv: 'OPENROUTER_BASE_URL',
    defaultBase: 'https://openrouter.ai',
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'google/gemini-2.5-flash'
  }
];

function configured() {
  return PROVIDERS.filter(p => process.env[p.keyEnv]);
}

function available() {
  return configured().length > 0;
}

function activeProvider() {
  const list = configured();
  return list.length ? list[0].name : null;
}

function modelFor(p) {
  return process.env[p.modelEnv] || p.defaultModel;
}

function baseUrlFor(p) {
  return (process.env[p.baseUrlEnv] || p.defaultBase).replace(/\/+$/, '');
}

// ── Content normalization ──────────────────────────────────────────
// Accepts a string, or parts in either shape:
//   { type:'text', text }  and  { type:'image', dataUrl } (KAIZEN shape)
//   { type:'image', source:{ type:'base64', media_type, data } } (Anthropic shape)

function normalizeContent(content) {
  if (typeof content === 'string') return { text: content, images: [] };
  const text = [];
  const images = [];
  for (const part of Array.isArray(content) ? content : []) {
    if (!part) continue;
    if (part.type === 'text' && part.text) text.push(String(part.text));
    else if (part.type === 'image') {
      if (part.dataUrl) {
        const m = String(part.dataUrl).match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (m) images.push({ mimeType: m[1], base64: m[2], dataUrl: part.dataUrl });
      } else if (part.source && part.source.type === 'base64') {
        images.push({
          mimeType: part.source.media_type,
          base64: part.source.data,
          dataUrl: 'data:' + part.source.media_type + ';base64,' + part.source.data
        });
      }
    }
  }
  return { text: text.join('\n\n'), images };
}

// ── Payload builders (one per provider) ────────────────────────────

function anthropicPayload(system, norm, maxTokens, stream) {
  const content = [];
  for (const img of norm.images) {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } });
  }
  content.push({ type: 'text', text: norm.text || ' ' });
  return JSON.stringify({
    model: null, // filled by caller
    max_tokens: maxTokens || 900,
    stream: !!stream,
    system,
    messages: [{ role: 'user', content }]
  });
}

function geminiPayload(system, norm, maxTokens) {
  const parts = [];
  for (const img of norm.images) parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  parts.push({ text: norm.text || ' ' });
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { maxOutputTokens: maxTokens || 900 }
  });
}

function openrouterPayload(system, norm, maxTokens, stream) {
  let userContent = norm.text;
  if (norm.images.length) {
    userContent = [{ type: 'text', text: norm.text || ' ' }];
    for (const img of norm.images) userContent.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  }
  return JSON.stringify({
    model: null, // filled by caller
    max_tokens: maxTokens || 900,
    stream: !!stream,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent }
    ]
  });
}

// ── HTTP plumbing (https only; no new dependencies) ────────────────

function postJSON(url, headers, payload, { onData, timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? require('http') : https;
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search,
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers, {
        'Content-Length': Buffer.byteLength(payload)
      })
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        const s = chunk.toString();
        data += s;
        if (onData) onData(s);
      });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs || 45000, () => {
      req.destroy();
      reject(new Error('LLM request timeout'));
    });
    req.write(payload);
    req.end();
  });
}

/** Parse an SSE byte-stream into `data:` events. Feed it raw chunk strings. */
function makeSSEParser(onData) {
  let buffer = '';
  return function feed(chunk) {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith('data:')) onData(line.slice(5).trim());
    }
  };
}

// ── Provider adapters ──────────────────────────────────────────────

const adapters = {
  anthropic: {
    // Non-streaming call (streaming lives in streamAnthropic below).
    async call(p, system, content, maxTokens) {
      const norm = normalizeContent(content);
      const payload = JSON.parse(anthropicPayload(system, norm, maxTokens, false));
      payload.model = modelFor(p);
      const res = await postJSON(
        baseUrlFor(p) + '/v1/messages',
        { 'x-api-key': process.env[p.keyEnv], 'anthropic-version': '2023-06-01' },
        JSON.stringify(payload)
      );
      if (res.status !== 200) throw new Error('Anthropic HTTP ' + res.status + ': ' + res.body.slice(0, 300));
      const parsed = JSON.parse(res.body);
      const text = (parsed.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      if (!text) throw new Error('Unexpected Anthropic response shape');
      return text;
    }
  }
};

// ── Streaming, provider by provider ────────────────────────────────
// Each adapter's stream() is an async generator that yields text chunks.
// Buffering note: postJSON collects the whole body; for true incremental
// delivery we hand it an onData collector that pushes into a queue and
// resolve chunks as they arrive via a small async queue.

function makeQueue() {
  const items = [];
  let wake = null;
  let done = false;
  let error = null;
  return {
    push(x) { items.push(x); if (wake) { const w = wake; wake = null; w(); } },
    finish() { done = true; if (wake) { const w = wake; wake = null; w(); } },
    fail(e) { error = e; done = true; if (wake) { const w = wake; wake = null; w(); } },
    async *drain() {
      for (;;) {
        while (items.length) yield items.shift();
        if (error) throw error;
        if (done) return;
        await new Promise((r) => { wake = r; });
      }
    }
  };
}

function streamAnthropic(p, system, content, maxTokens) {
  const q = makeQueue();
  const norm = normalizeContent(content);
  const payload = JSON.parse(anthropicPayload(system, norm, maxTokens, true));
  payload.model = modelFor(p);
  const parser = makeSSEParser((data) => {
    if (data === '[DONE]') return;
    try {
      const evt = JSON.parse(data);
      if (evt.type === 'content_block_delta' && evt.delta && typeof evt.delta.text === 'string') {
        q.push(evt.delta.text);
      } else if (evt.type === 'error') {
        q.fail(new Error('Anthropic stream error: ' + JSON.stringify(evt.error || {}).slice(0, 200)));
      }
    } catch (e) { /* keep-alive or partial — ignore */ }
  });
  postJSON(
    baseUrlFor(p) + '/v1/messages',
    { 'x-api-key': process.env[p.keyEnv], 'anthropic-version': '2023-06-01' },
    JSON.stringify(payload),
    { timeoutMs: 120000, onData: parser }
  ).then((res) => {
    if (res.status !== 200) {
      q.fail(new Error('Anthropic HTTP ' + res.status + ': ' + res.body.slice(0, 300)));
    } else {
      q.finish();
    }
  }).catch((e) => q.fail(e));
  return q.drain();
}

function streamGemini(p, system, content, maxTokens) {
  const q = makeQueue();
  const norm = normalizeContent(content);
  const payload = geminiPayload(system, norm, maxTokens);
  const model = modelFor(p);
  const parser = makeSSEParser((data) => {
    if (data === '[DONE]') return;
    try {
      const evt = JSON.parse(data);
      const parts = evt.candidates && evt.candidates[0] && evt.candidates[0].content &&
        evt.candidates[0].content.parts;
      if (parts) {
        const text = parts.map(x => x.text || '').join('');
        if (text) q.push(text);
      }
      if (evt.error) {
        q.fail(new Error('Gemini stream error: ' + JSON.stringify(evt.error).slice(0, 200)));
      }
    } catch (e) { /* ignore partials */ }
  });
  postJSON(
    baseUrlFor(p) + '/v1beta/models/' + model + ':streamGenerateContent?alt=sse',
    { 'x-goog-api-key': process.env[p.keyEnv] },
    payload,
    { timeoutMs: 120000, onData: parser }
  ).then((res) => {
    if (res.status !== 200) {
      q.fail(new Error('Gemini HTTP ' + res.status + ': ' + res.body.slice(0, 300)));
    } else {
      q.finish();
    }
  }).catch((e) => q.fail(e));
  return q.drain();
}

function streamOpenRouter(p, system, content, maxTokens) {
  const q = makeQueue();
  const norm = normalizeContent(content);
  const payload = JSON.parse(openrouterPayload(system, norm, maxTokens, true));
  payload.model = modelFor(p);
  const parser = makeSSEParser((data) => {
    if (data === '[DONE]') return;
    try {
      const evt = JSON.parse(data);
      const delta = evt.choices && evt.choices[0] && evt.choices[0].delta;
      if (delta && typeof delta.content === 'string' && delta.content) q.push(delta.content);
    } catch (e) { /* ignore partials */ }
  });
  postJSON(
    baseUrlFor(p) + '/api/v1/chat/completions',
    {
      Authorization: 'Bearer ' + process.env[p.keyEnv],
      'HTTP-Referer': process.env.APP_URL || 'https://kaizen-trader.onrender.com',
      'X-Title': 'KAIZEN'
    },
    JSON.stringify(payload),
    { timeoutMs: 120000, onData: parser }
  ).then((res) => {
    if (res.status !== 200) {
      q.fail(new Error('OpenRouter HTTP ' + res.status + ': ' + res.body.slice(0, 300)));
    } else {
      q.finish();
    }
  }).catch((e) => q.fail(e));
  return q.drain();
}

// ── Public API: call & stream with provider failover ───────────────

async function callLLM(system, content, opts = {}) {
  const list = configured();
  if (!list.length) throw new Error('No AI provider key configured');
  let lastErr = null;
  for (const p of list) {
    try {
      if (p.name === 'anthropic') return await adapters.anthropic.call(p, system, content, opts.maxTokens);
      if (p.name === 'gemini') return await callGemini(p, system, content, opts.maxTokens);
      if (p.name === 'openrouter') return await callOpenRouter(p, system, content, opts.maxTokens);
    } catch (err) {
      console.error('llm [' + p.name + '] call failed:', err.message);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All providers failed');
}

async function callGemini(p, system, content, maxTokens) {
  const norm = normalizeContent(content);
  const res = await postJSON(
    baseUrlFor(p) + '/v1beta/models/' + modelFor(p) + ':generateContent',
    { 'x-goog-api-key': process.env[p.keyEnv] },
    geminiPayload(system, norm, maxTokens)
  );
  if (res.status !== 200) throw new Error('Gemini HTTP ' + res.status + ': ' + res.body.slice(0, 300));
  const parsed = JSON.parse(res.body);
  const parts = parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content &&
    parsed.candidates[0].content.parts;
  const text = parts ? parts.map(x => x.text || '').join('') : '';
  if (!text) throw new Error('Unexpected Gemini response shape');
  return text;
}

async function callOpenRouter(p, system, content, maxTokens) {
  const norm = normalizeContent(content);
  const payload = JSON.parse(openrouterPayload(system, norm, maxTokens, false));
  payload.model = modelFor(p);
  const res = await postJSON(
    baseUrlFor(p) + '/api/v1/chat/completions',
    {
      Authorization: 'Bearer ' + process.env[p.keyEnv],
      'HTTP-Referer': process.env.APP_URL || 'https://kaizen-trader.onrender.com',
      'X-Title': 'KAIZEN'
    },
    JSON.stringify(payload)
  );
  if (res.status !== 200) throw new Error('OpenRouter HTTP ' + res.status + ': ' + res.body.slice(0, 300));
  const parsed = JSON.parse(res.body);
  const text = parsed.choices && parsed.choices[0] && parsed.choices[0].message &&
    parsed.choices[0].message.content;
  if (!text) throw new Error('Unexpected OpenRouter response shape');
  return text;
}

/**
 * Async generator of text chunks. Failover only happens if a provider
 * fails BEFORE emitting anything (mid-stream failures rethrow — the
 * caller decides how to handle a partial reply).
 */
async function* streamLLM(system, content, opts = {}) {
  const list = configured();
  if (!list.length) throw new Error('No AI provider key configured');
  let lastErr = null;
  for (const p of list) {
    let emitted = false;
    try {
      const gen = p.name === 'anthropic' ? streamAnthropic(p, system, content, opts.maxTokens)
        : p.name === 'gemini' ? streamGemini(p, system, content, opts.maxTokens)
        : streamOpenRouter(p, system, content, opts.maxTokens);
      for await (const chunk of gen) {
        emitted = true;
        yield chunk;
      }
      return; // this provider completed the stream
    } catch (err) {
      console.error('llm [' + p.name + '] stream failed' + (emitted ? ' mid-stream' : '') + ':', err.message);
      if (emitted) throw err;
      lastErr = err;
    }
  }
  throw lastErr || new Error('All providers failed');
}

/**
 * Hide a trailing marker block while streaming (EXTRACTED: / PSYCH-STATE:).
 * push(chunk) → text safe to show (or '' ); flush() → { rest, tailFound }.
 */
function createTailHoldback(marker) {
  let buffer = '';
  let tailMode = false;
  return {
    push(chunk) {
      if (tailMode) { buffer += chunk; return ''; }
      buffer += chunk;
      const idx = buffer.indexOf(marker);
      if (idx >= 0) {
        const safe = buffer.slice(0, idx);
        buffer = buffer.slice(idx);
        tailMode = true;
        return safe;
      }
      // Hold back enough characters for the marker to still arrive split.
      const hold = Math.max(0, marker.length - 1);
      const safe = buffer.slice(0, Math.max(0, buffer.length - hold));
      buffer = buffer.slice(safe.length);
      return safe;
    },
    flush() {
      const rest = buffer;
      buffer = '';
      return { rest: tailMode ? '' : rest, tail: tailMode ? rest : '', tailFound: tailMode };
    }
  };
}

module.exports = {
  available,
  activeProvider,
  callLLM,
  streamLLM,
  createTailHoldback,
  makeSSEParser,
  normalizeContent,
  _internal: { configured, modelFor, baseUrlFor, geminiPayload, openrouterPayload, anthropicPayload }
};
