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
function file(name, size = 3, type = 'image/png') {
  return { name, size, type, lastModified: 123, bytes: Uint8Array.from([1, 2, 3]) };
}
function picker({ useTransfer = true, formdata = false, failAssignment = false, supportReader = true, nativeFile = false } = {}) {
  const input = new Element(); input.name = 'chartImage'; input.form = new Element();
  let selected = [];
  let assignmentCount = 0;
  Object.defineProperty(input, 'files', {
    get: () => selected,
    set: value => { if (failAssignment && ++assignmentCount > 1) throw new Error('assignment failed'); selected = value; }
  });
  Object.defineProperty(input, 'value', {
    get: () => '', set: value => { if (value === '') selected = []; }
  });
  const hint = new Element(); const grid = new Element();
  const revoked = []; const reads = [];
  const URL = { createObjectURL: f => 'blob:' + f.name, revokeObjectURL: u => revoked.push(u) };
  const document = { getElementById(id) { return { chartImageInput: input, chartImageCountHint: hint, chartImagePreviewGrid: grid }[id]; }, createElement: () => new Element() };
  const window = { addEventListener() {} };
  if (formdata) window.FormDataEvent = function () {};
  class DataTransfer {
    constructor() { this.files = []; this.items = { add: f => this.files.push(f) }; }
  }
  class FileReader {
    constructor() { reads.push(this); this.aborted = false; }
    readAsArrayBuffer(f) { this.source = f; }
    abort() { this.aborted = true; }
    complete() { this.result = Uint8Array.from(this.source.bytes).buffer; this.onload(); }
    fail() { this.onerror(); }
  }
  class File {
    constructor(parts, name, options) {
      this.bytes = Uint8Array.from(new Uint8Array(parts[0]));
      this.name = name; this.type = options.type; this.size = this.bytes.length; this.lastModified = options.lastModified;
    }
  }
  const context = { document, window, URL };
  if (useTransfer) context.DataTransfer = DataTransfer;
  if (supportReader) { context.FileReader = FileReader; context.File = nativeFile ? globalThis.File : File; }
  vm.runInNewContext(fs.readFileSync('public/js/session-image-picker.js', 'utf8'), context);
  function select(files) { selected = files; input.handlers.change(); }
  function complete() { reads.filter(r => !r.completed && !r.aborted).forEach(r => { r.completed = true; r.complete(); }); }
  function remove(index) { grid.children[index].children.find(c => c.className === 'k-image-remove').click(); }
  function submit() { let blocked = false; input.form.handlers.submit({ preventDefault() { blocked = true; } }); return !blocked; }
  return { input, hint, grid, revoked, reads, select, complete, remove, submit };
}

test('session picker snapshots bytes and preserves them after the Android source changes', () => {
  const p = picker();
  const first = file('first.png'), wrong = file('wrong.png'), third = file('third.png');
  p.select([first, wrong, third]);
  assert.equal(p.grid.children.length, 3);
  assert.equal(p.submit(), false, 'cannot submit while copies are being prepared');
  p.complete();
  assert.equal(p.submit(), true);
  assert.notEqual(p.input.files[0], first, 'upload is a new in-memory File');
  assert.deepEqual([...p.input.files[0].bytes], [1, 2, 3]);
  first.bytes[0] = 9;
  assert.deepEqual([...p.input.files[0].bytes], [1, 2, 3], 'source edits do not change the upload');
  const remove = p.grid.children[1].children.find(c => c.className === 'k-image-remove');
  assert.equal(remove.attributes['aria-label'], 'Remove wrong.png');
  remove.click();
  assert.deepEqual(p.input.files.map(f => f.name), ['first.png', 'third.png']);
  p.select([file('replacement.png')]); p.complete();
  assert.deepEqual(p.input.files.map(f => f.name), ['first.png', 'third.png', 'replacement.png']);
  assert.ok(p.revoked.includes('blob:wrong.png'));
});

test('session picker enforces limits before copying and preserves selection order', () => {
  const p = picker();
  p.select(Array.from({ length: 9 }, (_, i) => file(i + '.png')).concat([file('big.png', 6 * 1024 * 1024), file('bad.svg', 10, 'image/svg+xml')]));
  assert.equal(p.reads.length, 8);
  assert.match(p.hint.textContent, /Some images were not added/);
  // Reads may finish out of order, but uploads follow the selection order.
  p.reads.slice().reverse().forEach(r => { r.completed = true; r.complete(); });
  assert.equal(p.input.files.length, 8);
  assert.deepEqual(p.input.files.map(f => f.name), Array.from({ length: 8 }, (_, i) => i + '.png'));
});

test('a failed read blocks saving and removing it allows a fresh selection', () => {
  const p = picker();
  p.select([file('changed.png')]);
  p.reads[0].fail();
  assert.match(p.hint.textContent, /could not be read/i);
  assert.equal(p.submit(), false);
  assert.equal(p.input.files.length, 0);
  p.remove(0);
  assert.equal(p.submit(), true);
  p.select([file('changed.png')]); p.complete();
  assert.equal(p.submit(), true);
  assert.deepEqual(p.input.files.map(f => f.name), ['changed.png']);
});

test('an incomplete image read cannot be submitted as a valid upload', () => {
  const p = picker();
  const image = file('partial.png');
  p.select([image]);
  image.bytes = Uint8Array.from([1]);
  p.complete();
  assert.match(p.hint.textContent, /could not be read/i);
  assert.equal(p.submit(), false);
  assert.equal(p.input.files.length, 0);
});

test('removing a pending image cancels its read and ignores late completion', () => {
  const p = picker();
  p.select([file('wrong.png')]);
  const old = p.reads[0];
  p.remove(0);
  assert.equal(old.aborted, true);
  old.complete();
  assert.equal(p.input.files.length, 0);
  assert.equal(p.grid.children.length, 0);
  assert.equal(p.submit(), true);
});

test('formdata fallback submits only memory copies remaining after removal', () => {
  const p = picker({ useTransfer: false, formdata: true });
  p.select([file('a.png'), file('b.png')]); p.complete();
  p.remove(0);
  const submitted = [];
  p.input.form.handlers.formdata({ formData: { delete: name => submitted.push(['delete', name]), append: (name, f) => submitted.push([name, f.name]) } });
  assert.deepEqual(submitted, [['delete', 'chartImage'], ['chartImage', 'b.png']]);
  assert.equal(p.submit(), true);
});

test('assignment failures use formdata or block instead of silently dropping uploads', () => {
  const fallback = picker({ failAssignment: true, formdata: true });
  fallback.select([file('a.png')]); fallback.complete();
  const submitted = [];
  fallback.input.form.handlers.formdata({ formData: { delete() {}, append: (name, f) => submitted.push(f.name) } });
  assert.deepEqual(submitted, ['a.png']);
  assert.equal(fallback.submit(), true);
  const blocked = picker({ failAssignment: true });
  blocked.select([file('a.png')]); blocked.complete();
  assert.match(blocked.hint.textContent, /could not prepare/i);
  assert.equal(blocked.submit(), false);
  blocked.remove(0);
  assert.equal(blocked.submit(), true);
});

test('memory snapshot is accepted by the server multipart image parser', async t => {
  const express = require('express');
  const multer = require('multer');
  const app = express();
  app.post('/record', multer({ storage: multer.memoryStorage() }).single('chartImage'), (req, res) => {
    res.json({ name: req.file.originalname, type: req.file.mimetype, bytes: [...req.file.buffer], notes: req.body.notes });
  });
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => server.close());
  const p = picker({ nativeFile: true });
  const source = file('chart.png');
  p.select([source]); p.complete();
  source.bytes[0] = 9;
  const body = new FormData();
  body.append('notes', 'Kept the plan');
  body.append('chartImage', p.input.files[0]);
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/record', { method: 'POST', body });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name: 'chart.png', type: 'image/png', bytes: [1, 2, 3], notes: 'Kept the plan' });
});

test('unsupported browser keeps the native input instead of discarding files', () => {
  const p = picker({ useTransfer: false, supportReader: false });
  assert.match(p.hint.textContent, /cannot prepare image copies/i);
  assert.equal(p.input.handlers.change, undefined);
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
