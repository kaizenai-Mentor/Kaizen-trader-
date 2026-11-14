const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const privacy = require('../services/aiPrivacy');
const llm = require('../services/llm');
const aiCoach = require('../services/aiCoach');
const tradeCoach = require('../services/tradeCoach');
const psychCoach = require('../services/psychCoach');
const improveCoach = require('../services/improveCoach');

const user = { username: 'TraderDennis77', email: 'dennis@example.com' };
const keys = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_BASE_URL', 'GEMINI_BASE_URL', 'OPENROUTER_BASE_URL', 'AI_ALERT_EMAIL', 'RESEND_API_KEY'];
const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
for (const k of keys) delete process.env[k];
test.after(() => { for (const k of keys) original[k] === undefined ? delete process.env[k] : process.env[k] = original[k]; });

test('recognizes common identifiers and preserves trading facts', () => {
  const source = 'TraderDennis77: EURUSD entry 1.08765, 4H, 1% risk, +45 pips. Email dennis@example.com. Phone +234 803 123 4567. Account number 12345678. password: supersecret. Card 4111 1111 1111 1111.';
  const cleaned = privacy.sanitizeText(source, privacy.identitiesForUser(user));
  for (const secret of ['TraderDennis77', 'dennis@example.com', '+234 803 123 4567', '12345678', 'supersecret', '4111 1111 1111 1111']) assert.ok(!cleaned.includes(secret), secret);
  for (const fact of ['EURUSD', '1.08765', '4H', '1% risk', '+45 pips']) assert.ok(cleaned.includes(fact), fact);
  assert.match(source, /12345678/, 'original remains unchanged');
});

test('handles labeled secrets, phone, names and repeated identities without corrupting similar words', () => {
  const src = 'Account: AB123456. broker account no 88662211; phone: 0803 123 4567\nseed phrase: apple orange pear mango\nPassword is secret!';
  const clean = privacy.sanitizeText(src);
  for (const v of ['AB123456', '88662211', '0803 123 4567', 'apple', 'orange', 'pear', 'mango', 'secret']) assert.ok(!clean.includes(v), v);
  assert.equal(privacy.sanitizeText('ann Anna AnnA announced', ['Anna']), 'ann [removed] [removed] announced');
  assert.equal(privacy.sanitizeText('Risk 0.5%, time 08:30, 1:2.5 RR, price 1.1234567890123'), 'Risk 0.5%, time 08:30, 1:2.5 RR, price 1.1234567890123');
  assert.equal(privacy.sanitizeText('My name is Ada Okafor and phone 08031234567.'), 'My name is [removed] and phone [removed].');
});

test('AI prompt builders omit the account username', () => {
  const system = {}, sessions = [];
  const inputs = [
    aiCoach.buildSystemPrompt({ user, system, session: { sessionType: 'LIVE' }, recentHistory: '', scoreBrief: '' }),
    tradeCoach.buildSystemPrompt({ user, system, sessions }),
    psychCoach.buildSystemPrompt({ user, system, sessions }),
    improveCoach.buildSystemPrompt({ user, system, sessions })
  ];
  for (const prompt of inputs) assert.doesNotMatch(prompt, /TraderDennis77/);
});

function fake(handler) {
  return new Promise(resolve => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ s, url: 'http://127.0.0.1:' + s.address().port }));
  });
}

test('every provider retry receives cleaned combined text, with images left unchanged', async t => {
  const captured = [];
  const server = await fake((req, res) => {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => {
      captured.push({ path: req.url, body: JSON.parse(body) });
      if (req.url === '/v1/messages' || req.url.startsWith('/v1beta/')) { res.writeHead(429); res.end('{}'); }
      else res.end(JSON.stringify({ choices: [{ message: { content: 'review' } }] }));
    });
  });
  t.after(() => server.s.close());
  for (const name of ['ANTHROPIC', 'GEMINI', 'OPENROUTER']) { process.env[name + '_API_KEY'] = 'test'; process.env[name + '_BASE_URL'] = server.url; }
  const input = [{ type: 'text', text: 'email dennis@' }, { type: 'text', text: 'example.com account number: 12345678' }, { type: 'image', dataUrl: 'data:image/png;base64,QUJD' }];
  // Both pieces are combined with whitespace; test real values in each piece.
  input[0].text = 'Email dennis@example.com. TraderDennis77 entered EURUSD at 1.08765.';
  input[1].text = 'account number: 12345678';
  assert.equal(await llm.callLLM('TraderDennis77 password: secret99', input, { user }), 'review');
  assert.equal(captured.length, 3);
  for (const request of captured) {
    const body = JSON.stringify(request.body);
    for (const secret of ['dennis@example.com', 'TraderDennis77', '12345678', 'secret99']) assert.ok(!body.includes(secret), request.path + ' ' + secret);
    assert.ok(body.includes('EURUSD')); assert.ok(body.includes('1.08765')); assert.ok(body.includes('QUJD'));
  }
  assert.match(input[0].text, /dennis@example.com/, 'input is not mutated');
});

test('streaming request is also cleaned before sending', async t => {
  let body;
  const server = await fake((req, res) => {
    let src = ''; req.on('data', c => src += c); req.on('end', () => {
      body = JSON.parse(src);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: {"type":"content_block_delta","delta":{"text":"response"}}\n\ndata: {"type":"message_stop"}\n\n');
    });
  });
  t.after(() => server.s.close());
  delete process.env.GEMINI_API_KEY; delete process.env.OPENROUTER_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test'; process.env.ANTHROPIC_BASE_URL = server.url;
  let response = '';
  for await (const part of llm.streamLLM('Name TraderDennis77', 'Email dennis@example.com, GBPJPY 4H', { user, requireComplete: true })) response += part;
  assert.equal(response, 'response');
  assert.doesNotMatch(JSON.stringify(body), /TraderDennis77|dennis@example.com/);
  assert.match(JSON.stringify(body), /GBPJPY 4H/);
});
