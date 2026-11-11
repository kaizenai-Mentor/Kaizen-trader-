const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ejs = require('ejs');
const source = fs.readFileSync('public/js/voice-input.js', 'utf8');

function setup({ supported = true, secure = true } = {}) {
  let recognition;
  class MockRecognition {
    constructor() { recognition = this; }
    start() { this.started = true; }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
  }
  class FakeEvent { constructor(type, options) { this.type = type; this.bubbles = options.bubbles; } }
  const form = { handlers: {}, addEventListener(type, cb) { this.handlers[type] = cb; } };
  function control(id) {
    const target = {
      id, form, value: 'Existing text', selectionStart: 13, selectionEnd: 13, inputs: 0,
      setRangeText(text, start, end) {
        this.value = this.value.slice(0, start) + text + this.value.slice(end);
        this.selectionStart = this.selectionEnd = start + text.length;
      },
      dispatchEvent(e) { if (e.type === 'input' && e.bubbles) this.inputs++; }
    };
    const status = { textContent: '' };
    const label = { textContent: '' };
    const attrs = { 'data-voice-target': id, 'data-voice-status': id + '-status' };
    const button = {
      disabled: false, classList: { toggle() {} },
      getAttribute(k) { return attrs[k]; }, setAttribute(k, v) { attrs[k] = v; },
      querySelector() { return label; }, addEventListener(type, cb) { this[type] = cb; }
    };
    return { target, status, label, button, attrs };
  }
  const a = control('notes');
  const b = control('learned');
  const elements = { notes: a.target, 'notes-status': a.status, learned: b.target, 'learned-status': b.status };
  const document = { documentElement: { lang: 'en' }, getElementById(id) { return elements[id]; }, querySelectorAll() { return [a.button, b.button]; } };
  const window = { isSecureContext: secure, addEventListener(type, cb) { this[type] = cb; } };
  if (supported) window.webkitSpeechRecognition = MockRecognition;
  vm.runInNewContext(source, { window, document, Event: FakeEvent });
  return { a, b, form, window, get recognition() { return recognition; } };
}

test('unsupported or insecure environments explain the fallback without disabling typing', () => {
  const noApi = setup({ supported: false });
  assert.equal(noApi.a.button.disabled, true);
  assert.match(noApi.a.status.textContent, /not supported/);
  assert.equal(noApi.a.target.value, 'Existing text');
  const insecure = setup({ secure: false });
  assert.equal(insecure.a.button.disabled, true);
  assert.match(insecure.a.status.textContent, /HTTPS or localhost/);
});

test('final speech inserts at the caret, signals input and requires stop before submit', () => {
  const env = setup();
  env.a.button.click();
  const recognition = env.recognition;
  assert.equal(recognition.started, true);
  assert.equal(env.a.attrs['aria-pressed'], 'true');
  recognition.onstart();
  const result = [{ transcript: 'I waited' }]; result.isFinal = true;
  recognition.onresult({ resultIndex: 0, results: [result] });
  recognition.onresult({ resultIndex: 0, results: [result] });
  assert.equal(env.a.target.value, 'Existing text I waited');
  assert.equal(env.a.target.inputs, 1);
  assert.equal(env.window.kaizenVoice.canSubmit('notes'), false);
  let blocked = false;
  env.form.handlers.submit({ preventDefault() { blocked = true; }, stopImmediatePropagation() {} });
  assert.equal(blocked, true);
  env.a.button.click();
  assert.equal(recognition.stopped, true);
  assert.equal(env.window.kaizenVoice.canSubmit('notes'), false);
  recognition.onend();
  assert.equal(env.window.kaizenVoice.canSubmit('notes'), true);
  assert.equal(env.a.attrs['aria-pressed'], 'false');
  assert.match(env.a.status.textContent, /Review and edit/);
});

test('only one field listens, permission errors are shown, and old results cannot leak into a new session', () => {
  const env = setup();
  env.a.button.click();
  const old = env.recognition;
  env.b.button.click();
  assert.match(env.b.status.textContent, /Stop the other/);
  old.onerror({ error: 'not-allowed' });
  old.onend();
  assert.match(env.a.status.textContent, /denied/);
  env.a.button.click();
  const current = env.recognition;
  const result = [{ transcript: 'stale words' }]; result.isFinal = true;
  old.onresult({ resultIndex: 0, results: [result] });
  old.onend();
  assert.equal(env.a.target.value, 'Existing text');
  assert.equal(env.window.kaizenVoice.canSubmit('notes'), false);
  env.window.pagehide();
  assert.equal(current.aborted, true);
});

test('voice controls render on both KAIZEN AI modes and the two session steps', () => {
  for (const view of ['views/kaizen-ai.ejs', 'views/session-record.ejs', 'views/session-reflect.ejs']) {
    ejs.compile(fs.readFileSync(view, 'utf8'), { filename: view });
    assert.match(fs.readFileSync(view, 'utf8'), /voice-input\.js/);
    assert.match(fs.readFileSync(view, 'utf8'), /browser may send audio/);
  }
  const ai = fs.readFileSync('views/kaizen-ai.ejs', 'utf8');
  assert.equal((ai.match(/target: 'ai-input'/g) || []).length, 2);
});
