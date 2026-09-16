/**
 * Progress service tests — My Progress computations (spec §2.8).
 * Pure functions: no DB, no AI, no clock.
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  timeline, movement, typePerformance, nextSessionMilestone, sparklinePoints
} = require('../services/progress');

const now = new Date('2026-09-13T12:00:00Z');
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

const snap = (overall, daysBack, dims = {}) => ({
  overall, overallState: 'READY',
  computedAt: daysAgo(daysBack),
  dimensions: Object.fromEntries(['process', 'risk', 'execution', 'behavior', 'learning']
    .map(k => [k, { score: dims[k] != null ? dims[k] : overall, state: 'READY', reasons: [] }]))
});

// ── timeline ─────────────────────────────────────────────────────

test('timeline keeps only computed scores, in order', () => {
  const pts = timeline([
    { overall: null, computedAt: daysAgo(40) },   // Building — excluded
    snap(52, 35),
    snap(61, 20),
    snap(74, 1)
  ]);
  assert.equal(pts.length, 3);
  assert.deepEqual(pts.map(p => p.v), [52, 61, 74]);
});

// ── movement ─────────────────────────────────────────────────────

test('movement compares latest vs ~30 days ago', () => {
  const m = movement([snap(52, 45), snap(61, 20), snap(74, 1)], 30, now);
  assert.equal(m.overall.now, 74);
  assert.equal(m.overall.then, 52); // 61@20d is inside the window; newest ≤ cutoff is 52@45d
  assert.equal(m.overall.delta, 22);
  assert.equal(m.dimensions.process.delta, 22);
});

test('movement falls back to earliest snapshot when history is young', () => {
  const m = movement([snap(50, 10), snap(58, 2)], 30, now);
  assert.equal(m.overall.then, 50);
  assert.equal(m.overall.delta, 8);
  assert.equal(m.overall.same, false);
});

test('single snapshot → zero movement, flagged same', () => {
  const m = movement([snap(66, 3)], 30, now);
  assert.equal(m.overall.delta, 0);
  assert.equal(m.overall.same, true);
});

test('Building dimensions stay null — never guessed', () => {
  const partial = {
    overall: 60, computedAt: daysAgo(35),
    dimensions: { process: { score: 60 }, risk: { score: null } }
  };
  const m = movement([partial, snap(70, 1, { risk: 70 })], 30, now);
  assert.equal(m.dimensions.risk.delta, null);
  assert.equal(m.dimensions.risk.then, null);
  assert.equal(m.dimensions.risk.now, 70);
});

test('no usable snapshots → null (page shows Building state)', () => {
  assert.equal(movement([{ overall: null }]), null);
  assert.equal(movement([]), null);
});

// ── practice vs performance ──────────────────────────────────────

test('the gap insight fires when backtest discipline beats live by 10+', () => {
  const sessions = [
    ...Array(5).fill({ sessionType: 'BACKTEST', ruleCompliance: true }),   // 100%
    ...Array(4).fill({ sessionType: 'LIVE', ruleCompliance: false }),
    { sessionType: 'LIVE', ruleCompliance: true }                            // 20%
  ];
  const tp = typePerformance(sessions);
  assert.equal(tp.types.BACKTEST.rate, 100);
  assert.equal(tp.types.LIVE.rate, 20);
  assert.equal(tp.insight.kind, 'gap');
  assert.match(tp.insight.message, /80 points above/);
  assert.match(tp.insight.message, /The gap is the work/);
});

test('inverse gap: live sharper than practice', () => {
  const sessions = [
    ...Array(4).fill({ sessionType: 'LIVE', ruleCompliance: true }),
    { sessionType: 'LIVE', ruleCompliance: false },                          // 80%
    ...Array(5).fill({ sessionType: 'BACKTEST', ruleCompliance: false })
  ];
  const tp = typePerformance(sessions);
  assert.equal(tp.insight.kind, 'inverse');
});

test('no insight without enough data on both sides — honesty over guessing', () => {
  const tp = typePerformance([{ sessionType: 'LIVE', ruleCompliance: true }]);
  assert.equal(tp.insight, null);
  assert.equal(tp.types.STUDY.rate, null);
});

// ── milestones + sparkline ───────────────────────────────────────

test('next session milestone math', () => {
  assert.deepEqual(nextSessionMilestone(17), { label: '25 sessions logged', progress: 68, remaining: 8 });
  assert.deepEqual(nextSessionMilestone(0), { label: '5 sessions logged', progress: 0, remaining: 5 });
  const legend = nextSessionMilestone(600);
  assert.equal(legend.progress, 100);
  assert.match(legend.label, /legend territory/);
});

test('sparkline points normalize into the viewBox', () => {
  const pts = [{ v: 0 }, { v: 50 }, { v: 100 }];
  const s = sparklinePoints(pts, 100, 40);
  const arr = s.split(' ');
  assert.equal(arr.length, 3);
  assert.equal(arr[0], '0.0,40.0');   // v=0 → bottom
  assert.equal(arr[1], '50.0,20.0');  // midpoint
  assert.equal(arr[2], '100.0,0.0');  // v=100 → top
  assert.equal(sparklinePoints([]), '');
  assert.equal(sparklinePoints([{ v: 50 }], 100, 40), '50.0,20.0');
});
