const test = require('node:test');
const assert = require('node:assert/strict');
const createReveal = require('../public/js/session-review-reveal');

function setup(reducedMotion) {
  const queue = [];
  const output = { textContent: '' }, status = { textContent: '' }, typing = { hidden: true };
  let done = 0;
  const reveal = createReveal({ output, status, typing, reducedMotion, schedule: fn => queue.push(fn), onDone: () => done++ });
  const run = () => { while (queue.length) queue.shift()(); };
  return { reveal, output, status, typing, run, done: () => done };
}

test('backspaces old text while buffering incoming response and completion', () => {
  const s = setup(false);
  s.reveal.delta('This is a long unfinished Claude response.');
  s.reveal.reset(true);
  assert.match(s.status.textContent, /another provider/i);
  assert.ok(s.output.textContent.length > 0);
  assert.ok(s.output.textContent.length < 'This is a long unfinished Claude response.'.length);
  s.reveal.delta('Gemini response'); s.reveal.done();
  assert.doesNotMatch(s.output.textContent, /Gemini/);
  assert.equal(s.done(), 0);
  s.run();
  assert.equal(s.output.textContent, 'Gemini response');
  assert.equal(s.done(), 1);
});

test('repeated failures discard all queued text, including late completion', () => {
  const s = setup(false);
  s.reveal.delta('Claude partial'); s.reveal.reset(true);
  s.reveal.delta('Gemini partial'); s.reveal.reset(false);
  s.reveal.delta('Limited automated response'); s.reveal.done(); s.reveal.done();
  s.run();
  assert.equal(s.output.textContent, 'Limited automated response');
  assert.equal(s.done(), 1);
});

test('reduced motion erases immediately and preserves Unicode', () => {
  const s = setup(true);
  s.reveal.delta('失敗 🚀'); s.reveal.reset(true);
  assert.equal(s.output.textContent, '');
  s.reveal.delta('成功 ✅'); s.reveal.done();
  assert.equal(s.output.textContent, '成功 ✅');
  assert.equal(s.done(), 1);
});
