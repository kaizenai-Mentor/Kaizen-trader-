#!/usr/bin/env node
/* Offline privacy demonstration. Fixed fictional data, no external provider. */
const http = require('http');
const assert = require('assert/strict');
const llm = require('../services/llm');

async function main() {
  const fixture = 'EURUSD at 1.08765. Email trader@example.com. Account number: 12345678. Password: demo-secret.';
  let outbound = '';
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const payload = JSON.parse(body);
      outbound = payload.messages[0].content.filter(part => part.type === 'text').map(part => part.text).join('');
      // This fake provider echoes the text exactly to demonstrate restoration.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: [{ type: 'text', text: outbound }] }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    process.env.ANTHROPIC_API_KEY = 'local-test-key';
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:' + server.address().port;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const reply = await llm.callLLM('Review the fictional note.', fixture);
    assert.ok(!outbound.includes('trader@example.com'));
    assert.ok(!outbound.includes('12345678'));
    assert.ok(!outbound.includes('demo-secret'));
    assert.ok(reply.includes('trader@example.com'));
    assert.ok(reply.includes('12345678'));
    assert.ok(!reply.includes('demo-secret'));
    console.log('OFFLINE TEST: fixed fictional data, no real provider contacted.');
    console.log('\nExample text received by the fake provider:');
    console.log(outbound);
    console.log('\nExample response after local restoration:');
    console.log(reply);
    console.log('\nPASS: known email and account number were hidden and restored; the password stayed removed.');
    console.log('This does not prove all sensitive information can be detected. Images are not filtered.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(err => { console.error('Offline privacy test failed:', err.message); process.exitCode = 1; });
