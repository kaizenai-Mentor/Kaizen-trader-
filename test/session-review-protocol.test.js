const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { TextDecoder, TextEncoder } = require('node:util');

function helperFor(chunks) {
  const source = fs.readFileSync('public/js/app.js', 'utf8');
  const start = source.indexOf('window.kaizenStream =');
  const end = source.indexOf('/* ── KAIZEN Branded Selection Menu', start);
  const bytes = chunks.map(x => new TextEncoder().encode(x));
  const window = {};
  vm.runInNewContext(source.slice(start, end), {
    window, TextDecoder,
    fetch: async () => ({ headers: { get: () => 'text/event-stream' }, body: { getReader: () => ({ read: async () => bytes.length ? { value: bytes.shift(), done: false } : { done: true } }) } })
  });
  return window.kaizenStream;
}

test('SSE reset precedes replacement, done is delivered once', async () => {
  const stream = helperFor(['data: {"type":"delta","text":"old"}\n\n', 'data: {"type":"reset","retrying":true}\n\ndata: {"type":"delta","text":"new"}\n\n', 'data: {"type":"done"}\n\n']);
  const events = [];
  await stream('/review', {}, { onDelta: t => events.push(t), onReset: e => events.push('reset:' + e.retrying), onDone: () => events.push('done'), onError: () => events.push('error') });
  assert.deepEqual(events, ['old', 'reset:true', 'new', 'done']);
});

test('truncated SSE signals an error, not a completed review', async () => {
  const stream = helperFor(['data: {"type":"delta","text":"partial"}\n\n']);
  const events = [];
  await stream('/review', {}, { onDelta: t => events.push(t), onDone: () => events.push('done'), onError: () => events.push('error') });
  assert.deepEqual(events, ['partial', 'error']);
});
