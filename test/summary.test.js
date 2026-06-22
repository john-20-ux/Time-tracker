import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateByTask, barPct, goalProgress, goalMap } from '../src/core/summary.js';

const entries = [
  { task: 'A', durationSec: 3600 },
  { task: 'B', durationSec: 1800 },
  { task: 'A', durationSec: 1800 },
];

test('aggregateByTask sums per task and totals', () => {
  const { agg, total, max, sorted } = aggregateByTask(entries);
  assert.deepEqual(agg, { A: 5400, B: 1800 });
  assert.equal(total, 7200);
  assert.equal(max, 5400);
  assert.deepEqual(sorted, [['A', 5400], ['B', 1800]]); // descending
});

test('aggregateByTask handles empty input', () => {
  const { agg, total, max, sorted } = aggregateByTask([]);
  assert.deepEqual(agg, {});
  assert.equal(total, 0);
  assert.equal(max, 0);
  assert.deepEqual(sorted, []);
});

test('barPct scales against the max, zero when no data', () => {
  assert.equal(barPct(5400, 5400), 100);
  assert.equal(barPct(2700, 5400), 50);
  assert.equal(barPct(100, 0), 0);
});

test('goalProgress reports done / percent / null', () => {
  assert.equal(goalProgress(3600, 0), null); // no goal
  assert.deepEqual(goalProgress(7200, 2), { done: true, pct: 100 }); // met exactly
  assert.deepEqual(goalProgress(3600, 2), { done: false, pct: 50 }); // halfway
});

test('goalMap builds name -> goal lookup', () => {
  const tasks = [{ name: 'A', goal: 2 }, { name: 'B', goal: 0 }, { name: 'C' }];
  assert.deepEqual(goalMap(tasks), { A: 2, B: 0, C: 0 });
});
