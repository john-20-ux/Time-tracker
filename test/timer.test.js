import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTimer, stopTimer, elapsedSeconds } from '../src/core/timer.js';

test('startTimer records task and start time', () => {
  assert.deepEqual(startTimer('A', 1000), { task: 'A', startTime: 1000 });
});

test('stopTimer returns the finished block', () => {
  const active = { task: 'A', startTime: 1000 };
  assert.deepEqual(stopTimer(active, 5000), { task: 'A', startTime: 1000, endTime: 5000 });
});

test('stopTimer returns null when nothing is running', () => {
  assert.equal(stopTimer(null, 5000), null);
});

test('elapsedSeconds rounds to whole seconds, never negative', () => {
  assert.equal(elapsedSeconds({ startTime: 0, endTime: 3600_000 }), 3600);
  assert.equal(elapsedSeconds({ startTime: 0, endTime: 1400 }), 1); // 1.4s -> 1
  assert.equal(elapsedSeconds({ startTime: 5000, endTime: 1000 }), 0); // clamped
});
