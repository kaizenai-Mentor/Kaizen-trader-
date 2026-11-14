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
  const timers = new Map();
  let timerId = 0;
  const window = {
    isSecureContext: secure, addEventListener(type, cb) { this[type] = cb; },
    setTimeout(cb) { const id = ++timerId; timers.set(id, cb); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  function flushTimer() { const [id, cb] = timers.entries().next().value || []; if (cb) { timers.delete(id); cb(); } }

  if (supported) window.webkitSpeechRecognition = MockRecognition;
  vm.runInNewContext(source, { window, document, Event: FakeEvent });
  return { a, b, form, window, timers, flushTimer, get recognition() { return recognition; } };
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


test('recognition restarts after Chrome ends a session and preserves the transcript until Stop', () => {
  const env = setup();
  env.a.button.click();
  const first = env.recognition;
  const one = [{ transcript: 'hello' }]; one.isFinal = true;
  first.onresult({ resultIndex: 0, results: [one] });
  first.onend();
  assert.match(env.a.status.textContent, /Restarting microphone/);
  assert.equal(env.window.kaizenVoice.canSubmit('notes'), false);
  env.flushTimer();
  const second = env.recognition;
  assert.notEqual(second, first);
  const two = [{ transcript: 'again' }]; two.isFinal = true;
  second.onresult({ resultIndex: 0, results: [two] });
  assert.equal(env.a.target.value, 'Existing text hello again');
  first.onresult({ resultIndex: 0, results: [one] });
  env.a.button.click();
  second.onend();
  assert.equal(env.a.target.value, 'Existing text hello again');
  assert.equal(env.timers.size, 0);
  assert.equal(env.window.kaizenVoice.canSubmit('notes'), true);
});

test('stop or page exit during the restart delay cancels the microphone restart', () => {
  const env = setup();
  env.a.button.click();
  env.recognition.onend();
  assert.equal(env.timers.size, 1);
  env.a.button.click();
  assert.equal(env.timers.size, 0);
  assert.equal(env.window.kaizenVoice.canSubmit('notes'), true);
  env.a.button.click();
  env.recognition.onend();
  env.window.pagehide();
  assert.equal(env.timers.size, 0);
  assert.equal(env.window.kaizenVoice.canSubmit('notes'), true);
});

test('no speech retries are bounded and permission errors do not retry', () => {
  const env = setup();
  env.a.button.click();
  for (let i = 0; i < 5; i++) {
    env.recognition.onerror({ error: 'no-speech' });
    env.recognition.onend();
    env.flushTimer();
  }
  assert.equal(env.timers.size, 0);
  assert.match(env.a.status.textContent, /No speech detected/);
  env.a.button.click();
  env.recognition.onerror({ error: 'not-allowed' });
  env.recognition.onend();
  assert.equal(env.timers.size, 0);
  assert.match(env.a.status.textContent, /denied/);
});

test('cockpit shows scores without explanations; progress retains reasons and install controls are absent', () => {
  const cockpit = fs.readFileSync('views/dashboard.ejs', 'utf8');
  const progress = fs.readFileSync('views/leaderboard.ejs', 'utf8');
  const navbar = fs.readFileSync('views/partials/navbar.ejs', 'utf8');
  assert.doesNotMatch(cockpit, /whyDims|k-whyblock|reasons\[0\]/);
  assert.match(cockpit, /score\.overall %>%/);
  assert.match(cockpit, /d\.score %>%/);
  assert.match(progress, /d\.reason/);
  assert.doesNotMatch(navbar, /Install KAIZEN App|Install App|triggerKaizenInstall|installAppModal/);
  for (const view of ['views/dashboard.ejs', 'views/partials/navbar.ejs']) {
    ejs.compile(fs.readFileSync(view, 'utf8'), { filename: view });
  }
});

test('interim speech is shown live and preserved when Android ends without a final result', () => {
  const env = setup();
  env.a.button.click();
  const recognition = env.recognition;
  assert.equal(recognition.interimResults, true);
  assert.equal(recognition.lang, 'en-US');
  const provisional = [{ transcript: 'waiting for the candle close' }]; provisional.isFinal = false;
  recognition.onresult({ resultIndex: 0, results: [provisional] });
  assert.match(env.a.status.textContent, /Hearing: waiting for the candle close/);
  assert.equal(env.a.target.value, 'Existing text');
  env.a.button.click();
  recognition.onend();
  assert.equal(env.a.target.value, 'Existing text waiting for the candle close');
});

test('final speech replaces provisional preview without duplicating words', () => {
  const env = setup();
  env.a.button.click();
  const recognition = env.recognition;
  const provisional = [{ transcript: 'I wait' }]; provisional.isFinal = false;
  const final = [{ transcript: 'I waited' }]; final.isFinal = true;
  recognition.onresult({ resultIndex: 0, results: [provisional] });
  recognition.onresult({ resultIndex: 0, results: [final] });
  env.a.button.click(); recognition.onend();
  assert.equal(env.a.target.value, 'Existing text I waited');
});

test('recognition with no returned words tells the user to check microphone and network', () => {
  const env = setup();
  env.a.button.click();
  env.recognition.onstart();
  env.flushTimer();
  assert.match(env.a.status.textContent, /No words received yet/);
  env.a.button.click(); env.recognition.onend();
});
