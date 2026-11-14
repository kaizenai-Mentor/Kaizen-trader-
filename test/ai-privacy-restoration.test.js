const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const privacy = require('../services/aiPrivacy');
const llm = require('../services/llm');

const keys = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_BASE_URL', 'GEMINI_BASE_URL', 'OPENROUTER_BASE_URL', 'AI_ALERT_EMAIL', 'RESEND_API_KEY'];
const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
for (const k of keys) delete process.env[k];
test.after(() => { for (const k of keys) saved[k] === undefined ? delete process.env[k] : process.env[k] = saved[k]; });
function fake(handler) { return new Promise(resolve => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => resolve({ s, url: 'http://127.0.0.1:' + s.address().port })); }); }

test('only exact per-request placeholders restore, including repeated values', () => {
  const a = privacy.createContext({ username: 'AdaTrader' });
  const b = privacy.createContext({ username: 'AdaTrader' });
  const input = 'AdaTrader email ada@example.com, account number: AB123456, email ada@example.com, password: Secret77, card 4111 1111 1111 1111.';
  const masked = a.text(input);
  assert.doesNotMatch(masked, /AdaTrader|ada@example.com|AB123456|Secret77|4111 1111/);
  assert.match(masked, /\[\[KZ_[a-f0-9]{32}_\d+\]\]/);
  assert.equal(a.restore(masked), input.replace('Secret77', '[removed]').replace('4111 1111 1111 1111', '[removed]'));
  assert.equal(b.restore(masked), masked, 'another request cannot restore these markers');
  assert.notEqual(a.text('ada@example.com'), b.text('ada@example.com'));
  const c = privacy.createContext();
  const previous = c.text('account number: Secret77');
  c.text('password: Secret77');
  assert.equal(c.restore(previous), 'account number: [removed]', 'credentials never reuse a previously restorable marker');
  assert.equal(c.text('account number: 4111111111111111'), 'account number: [removed]', 'payment card in a labelled account field stays removed');
});

test('stream restores every character boundary and hides unfinished markers', () => {
  const ctx = privacy.createContext();
  const masked = ctx.text('Email ada@example.com.');
  for (let i = 0; i <= masked.length; i++) {
    const r = ctx.createRestorer();
    assert.equal(r.push(masked.slice(0, i)) + r.push(masked.slice(i)) + r.flush(), 'Email ada@example.com.');
  }
  const r = ctx.createRestorer();
  const start = masked.indexOf('[[KZ_');
  assert.equal(r.push(masked.slice(0, start + 8)), 'Email ');
  assert.equal(r.flush(), '[removed]');
});

test('simultaneous calls keep markers and private data isolated', async t => {
  const received = [];
  const server = await fake((req, res) => {
    let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
      const payload = JSON.parse(raw); const text = payload.messages[0].content.find(p => p.type === 'text').text;
      received.push(text);
      setTimeout(() => res.end(JSON.stringify({ content: [{ type: 'text', text }] })), text.includes('EURUSD') ? 20 : 1);
    });
  });
  t.after(() => server.s.close());
  process.env.ANTHROPIC_API_KEY = 'fake'; process.env.ANTHROPIC_BASE_URL = server.url;
  const [a, b] = await Promise.all([
    llm.callLLM('Review', 'EURUSD email ada@example.com'),
    llm.callLLM('Review', 'GBPUSD email bob@example.com')
  ]);
  assert.equal(a, 'EURUSD email ada@example.com');
  assert.equal(b, 'GBPUSD email bob@example.com');
  assert.equal(received.length, 2);
  assert.doesNotMatch(received.join(' '), /ada@example.com|bob@example.com/);
  assert.notEqual(received[0].match(/\[\[KZ_[^\]]+\]\]/)[0], received[1].match(/\[\[KZ_[^\]]+\]\]/)[0]);
});

test('split placeholders restore after streaming failure and provider retry', async t => {
  let badPayload, goodPayload;
  const claude = await fake((req, res) => {
    let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
      badPayload = JSON.parse(raw);
      const text = badPayload.messages[0].content.find(p => p.type === 'text').text;
      const token = text.match(/\[\[KZ_[^\]]+\]\]/)[0];
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: 'Partial ' + token.slice(0, 9) } }) + '\n\n');
      setTimeout(() => res.end(), 5); // Missing message_stop.
    });
  });
  const gemini = await fake((req, res) => {
    let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
      goodPayload = JSON.parse(raw);
      const text = goodPayload.contents[0].parts.find(p => p.text).text;
      const token = text.match(/\[\[KZ_[^\]]+\]\]/)[0];
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const part of ['Review ', token.slice(0, 7), token.slice(7), ' complete']) res.write('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: part }] } }] }) + '\n\n');
      res.end('data: {"candidates":[{"finishReason":"STOP"}]}\n\n');
    });
  });
  t.after(() => { claude.s.close(); gemini.s.close(); });
  process.env.ANTHROPIC_API_KEY = 'fake'; process.env.ANTHROPIC_BASE_URL = claude.url;
  process.env.GEMINI_API_KEY = 'fake'; process.env.GEMINI_BASE_URL = gemini.url;
  delete process.env.OPENROUTER_API_KEY;
  const events = [];
  for await (const chunk of llm.streamLLM('Review', 'Email ada@example.com', { requireComplete: true, onReset: () => events.push('RESET') })) events.push(chunk);
  const joined = events.join('');
  assert.match(joined, /^Partial RESETReview ada@example.com complete$/);
  assert.doesNotMatch(JSON.stringify([badPayload, goodPayload]), /ada@example.com/);
  assert.doesNotMatch(joined, /\[\[KZ_/);
});

test('offline demo uses fictional data and produces an inspectable proof', () => {
  const output = execFileSync(process.execPath, ['scripts/test-ai-privacy.js'], { encoding: 'utf8' });
  assert.match(output, /no real provider contacted/);
  assert.match(output, /Example text received by the fake provider/);
  assert.match(output, /PASS:/);
});
