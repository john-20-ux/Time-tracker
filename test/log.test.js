import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SK } from '../src/shared/constants.js';
import { todayStr } from '../src/core/time.js';

// In-memory chrome.storage.local mock (store.js reads chrome lazily).
const mem = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
          if (k in mem) out[k] = mem[k];
        });
        return out;
      },
      async set(obj) { Object.assign(mem, obj); },
      async remove(keys) {
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete mem[k]);
      },
    },
  },
};

const { appendEntry, clearToday } = await import('../src/core/log.js');

beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
});

const entry = (durationSec, note = '') => ({
  task: 'A',
  start: new Date(2026, 5, 22, 9, 0, 0),
  end: new Date(2026, 5, 22, 10, 0, 0),
  duration: '01:00:00',
  durationSec,
  note,
  date: todayStr(),
});

test('appendEntry writes log, total, history bucket and date', async () => {
  await appendEntry(entry(3600));
  const log = JSON.parse(mem[SK.log]);
  assert.equal(log.length, 1);
  assert.equal(typeof log[0].start, 'string'); // stored as ISO
  assert.equal(mem[SK.total], '3600');
  assert.equal(mem[SK.logDate], todayStr());
  assert.equal(JSON.parse(mem[SK.history])[todayStr()].length, 1);
});

test('appendEntry accumulates total across entries', async () => {
  await appendEntry(entry(3600));
  await appendEntry(entry(1800));
  assert.equal(JSON.parse(mem[SK.log]).length, 2);
  assert.equal(mem[SK.total], '5400');
});

test('appendEntry rolls over a stale day into history', async () => {
  mem[SK.logDate] = '2000-01-01';
  mem[SK.log] = JSON.stringify([{ task: 'old', durationSec: 99 }]);
  mem[SK.total] = '99';
  await appendEntry(entry(3600));
  const hist = JSON.parse(mem[SK.history]);
  assert.equal(hist['2000-01-01'].length, 1); // archived
  assert.equal(JSON.parse(mem[SK.log]).length, 1); // fresh today
  assert.equal(mem[SK.total], '3600'); // reset, not 99+3600
});

test('clearToday empties today but keeps past history', async () => {
  mem[SK.history] = JSON.stringify({ '2000-01-01': [{ task: 'old' }] });
  await appendEntry(entry(3600));
  await clearToday();
  assert.equal(JSON.parse(mem[SK.log]).length, 0);
  assert.equal(mem[SK.total], '0');
  const hist = JSON.parse(mem[SK.history]);
  assert.equal(hist[todayStr()], undefined);
  assert.equal(hist['2000-01-01'].length, 1);
});
