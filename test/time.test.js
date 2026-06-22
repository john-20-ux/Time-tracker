import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pad, fmt, todayStr, dateLabel } from '../src/core/time.js';

test('pad zero-pads to two digits', () => {
  assert.equal(pad(3), '03');
  assert.equal(pad(42), '42');
  assert.equal(pad(0), '00');
});

test('fmt formats seconds as HH:MM:SS', () => {
  assert.equal(fmt(0), '00:00:00');
  assert.equal(fmt(59), '00:00:59');
  assert.equal(fmt(60), '00:01:00');
  assert.equal(fmt(3661), '01:01:01');
  assert.equal(fmt(36000), '10:00:00');
});

test('todayStr builds YYYY-MM-DD in local time', () => {
  const d = new Date(2026, 5, 22); // June 22, 2026 local
  assert.equal(todayStr(d), '2026-06-22');
});

test('dateLabel returns Today / Yesterday relative to now', () => {
  const now = new Date(2026, 5, 22);
  assert.equal(dateLabel('2026-06-22', now), 'Today');
  assert.equal(dateLabel('2026-06-21', now), 'Yesterday');
});

test('dateLabel returns a short date for older days', () => {
  const now = new Date(2026, 5, 22);
  // Not today/yesterday -> formatted weekday/month/day (locale-dependent text,
  // so just assert it is neither relative label and is non-empty).
  const label = dateLabel('2026-06-01', now);
  assert.notEqual(label, 'Today');
  assert.notEqual(label, 'Yesterday');
  assert.ok(label.length > 0);
});
