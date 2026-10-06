/**
 * V1 Evidence Extraction tests (config/App.js B6 transition mechanics).
 * Silence is "unknown" — never counted for or against.
 */
const test = require('node:test');
const assert = require('node:assert');
const { extractFacts, aggregateExtraction } = require('../services/extraction');

const j = (notes) => ({ notes });

test('explicitly stated deviation is extracted', () => {
  const { facts } = extractFacts(j('I moved my invalidation twice when price squeezed — that was fear.'));
  const dev = facts.find(f => f.dimension === 'execution');
  assert.ok(dev, 'execution fact expected');
  assert.strictEqual(dev.yes, false);
});

test('explicitly respected risk is extracted', () => {
  const { facts } = extractFacts(j('Sized in properly at 1%. Clean risk today.'));
  const risk = facts.find(f => f.dimension === 'risk');
  assert.ok(risk);
  assert.strictEqual(risk.yes, true);
});

test('explicitly violated risk is extracted', () => {
  const { facts } = extractFacts(j('I doubled my position after the first loss.'));
  const risk = facts.find(f => f.dimension === 'risk');
  assert.strictEqual(risk.yes, false);
});

test('silence extracts nothing — never counted against', () => {
  const { facts } = extractFacts(j('Took the trade. It worked out.'));
  assert.strictEqual(facts.length, 0);
});

test('FOMO mention is a behavior signal', () => {
  const { facts } = extractFacts(j('FOMO got me into this one.'));
  assert.ok(facts.some(f => f.dimension === 'behavior' && f.yes === false));
});

test('plan adherence language is extracted both ways', () => {
  assert.ok(extractFacts(j('I followed my plan exactly.')).facts.some(f => f.dimension === 'process' && f.yes === true));
  assert.ok(extractFacts(j('I entered without my setup confirming.')).facts.some(f => f.dimension === 'process' && f.yes === false));
});

test('aggregation: calm sessions and weak reflections still count, rates computed', () => {
  const agg = aggregateExtraction([
    j('Moved my stop when it squeezed. FOMO everywhere.'),
    j('Followed my plan. Sized in properly at 1%.'),
    j('Quiet day, no trade worth taking.')
  ]);
  // process: one explicit YES (followed plan), no explicit NO → rate 1
  assert.strictEqual(agg.process.rate, 1);
  // execution: one explicit NO (moved stop) → rate 0
  assert.strictEqual(agg.execution.rate, 0);
  // risk: one explicit YES → rate 1
  assert.strictEqual(agg.risk.rate, 1);
  // behavior: 2 calm of 3 (one FOMO) → rate 2/3
  assert.ok(Math.abs(agg.behavior.rate - 2 / 3) < 1e-9);
  // every session counted
  assert.strictEqual(agg.behavior.count, 3);
});

test('aggregation with no explicit facts returns nulls for strict dimensions', () => {
  const agg = aggregateExtraction([j('Nice day.'), j('Traded a bit.')]);
  assert.strictEqual(agg.process, null);
  assert.strictEqual(agg.risk, null);
  assert.strictEqual(agg.execution, null);
  assert.ok(agg.behavior, 'calm-behavior evidence still counts');
});

test('empty history aggregates to null-safe result', () => {
  assert.strictEqual(aggregateExtraction([]), null);
});
