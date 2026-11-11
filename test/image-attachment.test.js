const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ejs = require('ejs');

class Element {
  constructor() { this.children = []; this.handlers = {}; this.style = {}; this.attributes = {}; this._text = ''; this.hidden = false; }
  set textContent(v) { this._text = v; this.children = []; }
  get textContent() { return this._text; }
  appendChild(node) { this.children.push(node); }
  setAttribute(k, v) { this.attributes[k] = v; }
  addEventListener(k, fn) { this.handlers[k] = fn; }
  click() { this.handlers.click(); }
}
function file(name, size = 10, type = 'image/png') { return { name, size, type }; }
function picker({ useTransfer = true, formdata = false } = {}) {
  const input = new Element(); input.name = 'chartImage'; input.form = new Element(); input.files = [];
  const hint = new Element(); const grid = new Element();
  const revoked = [];
  const URL = { createObjectURL: f => 'blob:' + f.name, revokeObjectURL: u => revoked.push(u) };
  const document = { getElementById(id) { return { chartImageInput: input, chartImageCountHint: hint, chartImagePreviewGrid: grid }[id]; }, createElement: () => new Element() };
  const window = { addEventListener() {} };
  if (formdata) window.FormDataEvent = function () {};
  class DataTransfer {
    constructor() { this.files = []; this.items = { add: f => this.files.push(f) }; }
  }
  const context = { document, window, URL };
  if (useTransfer) context.DataTransfer = DataTransfer;
  vm.runInNewContext(fs.readFileSync('public/js/session-image-picker.js', 'utf8'), context);
  function select(files) { input.files = files; input.handlers.change(); }
  return { input, hint, grid, revoked, select };
}

test('session picker removes the actual submitted file and allows adding a replacement', () => {
  const p = picker();
  p.select([file('first.png'), file('wrong.png'), file('third.png')]);
  assert.equal(p.grid.children.length, 3);
  const remove = p.grid.children[1].children[1];
  assert.equal(remove.type, 'button');
  assert.equal(remove.attributes['aria-label'], 'Remove wrong.png');
  remove.click();
  assert.deepEqual(p.input.files.map(f => f.name), ['first.png', 'third.png']);
  p.select([file('replacement.png')]);
  assert.deepEqual(p.input.files.map(f => f.name), ['first.png', 'third.png', 'replacement.png']);
  assert.ok(p.revoked.includes('blob:wrong.png'));
  assert.equal(p.grid.children.length, 3);
});

test('session picker enforces limit and rejects files the server will not accept', () => {
  const p = picker();
  p.select(Array.from({ length: 9 }, (_, i) => file(i + '.png')).concat([file('big.png', 6 * 1024 * 1024), file('bad.svg', 10, 'image/svg+xml')]));
  assert.equal(p.input.files.length, 8);
  assert.equal(p.grid.children.length, 8);
  assert.match(p.hint.textContent, /Some images were not added/);
});

test('formdata fallback submits only remaining files after individual removal', () => {
  const p = picker({ useTransfer: false, formdata: true });
  p.select([file('a.png'), file('b.png')]);
  p.grid.children[0].children[1].click();
  const submitted = [];
  p.input.form.handlers.formdata({ formData: { delete: name => submitted.push(['delete', name]), append: (name, f) => submitted.push([name, f.name]) } });
  assert.deepEqual(submitted, [['delete', 'chartImage'], ['chartImage', 'b.png']]);
});

test('AI image remove clears pending data and late file reads cannot reattach it', () => {
  const input = new Element(); input.files = []; input.value = '';
  const container = new Element();
  let reader;
  class FileReader { constructor() { reader = this; } readAsDataURL() {} }
  const URL = { createObjectURL: f => 'blob:' + f.name, revokeObjectURL() {} };
  const window = { addEventListener() {} };
  vm.runInNewContext(fs.readFileSync('public/js/chat-image-attachment.js', 'utf8'), { window, URL, FileReader, document: { createElement: () => new Element() } });
  const attachment = window.createChatImageAttachment(input, container, 'Too large');
  input.files = [file('wrong.png')]; input.handlers.change();
  assert.equal(attachment.isLoading(), true);
  const oldReader = reader;
  container.children[0].children[1].click();
  oldReader.result = 'data:wrong'; oldReader.onload();
  assert.equal(attachment.getData(), null);
  input.files = [file('right.png')]; input.handlers.change();
  reader.result = 'data:right'; reader.onload();
  assert.equal(attachment.getData(), 'data:right');
  assert.equal(attachment.isLoading(), false);
  attachment.clear();
  assert.equal(attachment.getData(), null);
  assert.equal(container.hidden, true);
});

test('image controls are wired to both relevant views', () => {
  for (const view of ['views/session-record.ejs', 'views/kaizen-ai.ejs']) {
    const src = fs.readFileSync(view, 'utf8');
    ejs.compile(src, { filename: view });
    assert.match(src, /image-(picker|attachment)\.js/);
  }
});
