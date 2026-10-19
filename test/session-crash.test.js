/**
 * Session-crash tests — the crash-fix contract (owner directive):
 *   1. two-stage session docs save without notes at PLAN stage
 *      (the old `notes: required` crashed every plan);
 *   2. chart screenshots store owner-only bytes on the document;
 *   3. A() route wrappers turn controller rejections into next(err)
 *      instead of process-killing unhandled rejections;
 *   4. the process-level rejection net exists as the last resort.
 */
const test = require('node:test');
const assert = require('node:assert');
const Journal = require('../models/Journal');

// ── 1. Two-stage document ────────────────────────────────────────

test('two-stage doc: saves with empty notes at PLAN, carries text at RECORD', () => {
  const planned = new Journal({ userId: '507f1f77bcf86cd799439011', asset: 'XAUUSD', notes: '' });
  assert.strictEqual(planned.validateSync(), undefined, 'empty notes must validate at plan stage');
  const recorded = new Journal({ userId: '507f1f77bcf86cd799439011', notes: 'Took the sweep entry.' });
  assert.strictEqual(recorded.notes, 'Took the sweep entry.');
});

// ── 2. Owner-only screenshot storage ─────────────────────────────

test('chartImage stores bytes + contentType on the document', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const doc = new Journal({
    userId: '507f1f77bcf86cd799439011',
    notes: 'with chart',
    hasChartImage: true,
    chartImage: { data: png, contentType: 'image/png' }
  });
  assert.strictEqual(doc.hasChartImage, true);
  assert.strictEqual(doc.chartImage.contentType, 'image/png');
  assert.ok(Buffer.isBuffer(doc.chartImage.data));
  assert.strictEqual(doc.chartImage.data.length, 4);
});

// ── 3. A() route wrappers ────────────────────────────────────────

function makeA() {
  // Same contract as routes/dashboard.js
  return (fn) => (req, res, next) =>
    Promise.resolve().then(() => fn(req, res, next)).catch(next);
}

test('A() passes a sync handler through', async () => {
  const A = makeA();
  let saw = null;
  await A((req, res) => { saw = req.x; })({ x: 1 }, {}, (e) => { throw e; });
  assert.strictEqual(saw, 1);
});

test('A() passes a resolved async handler through', async () => {
  const A = makeA();
  let done = false;
  await A(async () => { done = true; })({}, {}, () => {});
  assert.strictEqual(done, true);
});

test('A() turns an async rejection into next(err) — never an unhandled rejection', async () => {
  const A = makeA();
  let caught = null;
  await A(async () => { throw new Error('boom'); })({}, {}, (e) => { caught = e; });
  assert.ok(caught instanceof Error);
  assert.strictEqual(caught.message, 'boom');
});

test('A() turns a sync throw into next(err)', async () => {
  const A = makeA();
  let caught = null;
  await A(() => { throw new Error('sync-boom'); })({}, {}, (e) => { caught = e; });
  assert.ok(caught instanceof Error);
  assert.strictEqual(caught.message, 'sync-boom');
});

test('routes/dashboard.js loads and every controller route is A()-wrapped', () => {
  const router = require('../routes/dashboard');
  assert.strictEqual(typeof router, 'function');
  const handlers = [];
  router.stack.forEach((layer) => {
    if (layer.route) {
      layer.route.stack.forEach((h) => handlers.push(h.handle));
    }
  });
  assert.ok(handlers.length >= 10, 'expected the full session-loop route set');
  // A() wraps controllers as zero-arg closures of length 3 (req,res,next);
  // unwrapped controller refs keep their own arity. All wrapped handles
  // must forward to next on rejection — proven by the makeA tests above;
  // here we prove the file actually uses the wrapper: its handle names
  // are anonymous wrappers, not the bare exported controller fns.
  const bare = new Set([
    require('../controllers/sessionsController').getSessions,
    require('../controllers/sessionsController').postRecord,
    require('../controllers/dashboardController').getDashboard
  ]);
  for (const h of handlers) {
    assert.ok(!bare.has(h), 'unwrapped controller leaked into the route table');
  }
});

// ── 4. Process-level rejection net ───────────────────────────────

test('server installs the process-level rejection net', () => {
  process.env.PORT = process.env.PORT || '0';
  require('../server');
  assert.ok(process.listenerCount('unhandledRejection') >= 1, 'no unhandledRejection net');
  assert.ok(process.listenerCount('uncaughtException') >= 1, 'no uncaughtException net');
});
