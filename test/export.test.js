import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv, buildTsv, buildSheetsPayload } from '../src/core/export.js';
import { cleanLabel, makeEntry } from '../src/core/model.js';

// Fixed dates so toLocaleString output is stable within a run.
const start = new Date(2026, 5, 22, 9, 0, 0);
const end = new Date(2026, 5, 22, 10, 0, 0);
const log = [
  { task: '📅  Daily Meetings', start, end, duration: '01:00:00', note: 'standup', date: '2026-06-22' },
];

test('buildCsv quotes task and note, has a header row', () => {
  const csv = buildCsv(log);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Task,Start,End,Duration,Note');
  assert.ok(lines[1].startsWith('"📅  Daily Meetings",'));
  assert.ok(lines[1].endsWith(',01:00:00,"standup"'));
});

test('buildTsv is tab-separated with header', () => {
  const tsv = buildTsv(log);
  const lines = tsv.split('\n');
  assert.equal(lines[0], 'Task\tStart\tEnd\tDuration (HH:MM:SS)\tNote');
  assert.equal(lines[1].split('\t').length, 5);
});

test('buildSheetsPayload maps entries and fills date', () => {
  const payload = buildSheetsPayload(log);
  assert.equal(payload.entries.length, 1);
  assert.equal(payload.entries[0].task, '📅  Daily Meetings');
  assert.equal(payload.entries[0].duration, '01:00:00');
  assert.equal(payload.entries[0].date, '2026-06-22');
});

test('cleanLabel strips the leading emoji prefix', () => {
  assert.equal(cleanLabel('📅  Daily Meetings'), 'Daily Meetings');
  assert.equal(cleanLabel('🔧  Technical Feasibility'), 'Technical Feasibility');
});

test('makeEntry derives duration string from elapsed seconds', () => {
  const e = makeEntry({ task: 'A', start, end, elapsedSec: 3600, date: '2026-06-22' });
  assert.equal(e.duration, '01:00:00');
  assert.equal(e.durationSec, 3600);
  assert.equal(e.note, '');
});
