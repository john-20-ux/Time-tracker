// Integration smoke test for the service worker. Imports the REAL worker module
// against a simulated chrome runtime and drives full start/stop/idle/overrun
// flows — the closest we can get to a browser without one.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SK } from '../src/shared/constants.js';
import { MSG } from '../src/shared/messages.js';

const mem = {};
const alarms = {};
const notifs = [];
let idleInterval = 0;

function evt() {
  const cbs = [];
  return { addListener: (cb) => cbs.push(cb), emit: (...a) => Promise.all(cbs.map((c) => c(...a))), cbs };
}

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in mem) out[k] = mem[k]; });
        return out;
      },
      async set(o) { Object.assign(mem, o); },
      async remove(keys) { (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete mem[k]); },
    },
    onChanged: evt(),
  },
  runtime: { onMessage: evt(), openOptionsPage: () => { globalThis.__optsOpened = (globalThis.__optsOpened || 0) + 1; } },
  alarms: {
    create: (name, opts) => { alarms[name] = opts; },
    clear: async (name) => { delete alarms[name]; return true; },
    onAlarm: evt(),
  },
  idle: { setDetectionInterval: (s) => { idleInterval = s; }, onStateChanged: evt() },
  notifications: { create: (o) => { notifs.push(o); } },
};

// Import after the mock is in place so the worker registers on it.
await import('../src/background/service-worker.js');

const send = (msg) => new Promise((res) => chrome.runtime.onMessage.cbs[0](msg, {}, res));
const flush = () => new Promise((res) => setTimeout(res, 0)); // let fire-and-forget async settle

beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
  for (const k of Object.keys(alarms)) delete alarms[k];
  notifs.length = 0;
  // Enable both features for the flows under test.
  mem[SK.notifOn] = 'true'; mem[SK.notifMins] = '90';
  mem[SK.idleOn] = 'true'; mem[SK.idleMins] = '5';
});

test('START_TIMER persists the active timer and schedules the overrun alarm', async () => {
  const res = await send({ type: MSG.START_TIMER, task: 'Research' });
  assert.equal(res.activeTimer.task, 'Research');
  assert.ok(mem[SK.activeTimer], 'activeTimer persisted');
  assert.ok(alarms['tt-overrun'], 'overrun alarm scheduled');
});

test('STOP_TIMER returns the finished block and clears state', async () => {
  await send({ type: MSG.START_TIMER, task: 'Research' });
  const res = await send({ type: MSG.STOP_TIMER });
  assert.equal(res.stopped.task, 'Research');
  assert.ok(typeof res.stopped.endTime === 'number');
  assert.equal(mem[SK.activeTimer], undefined, 'activeTimer cleared');
  assert.equal(alarms['tt-overrun'], undefined, 'overrun alarm cleared');
});

test('idle auto-stops the running timer and logs the block', async () => {
  await send({ type: MSG.START_TIMER, task: 'Research' });
  await chrome.idle.onStateChanged.emit('idle');
  assert.equal(mem[SK.activeTimer], undefined, 'timer stopped on idle');
  const log = JSON.parse(mem[SK.log]);
  assert.equal(log.length, 1);
  assert.equal(log[0].task, 'Research');
  assert.equal(log[0].note, '(auto-stopped: idle)');
  assert.equal(notifs.at(-1).title, '⏸ Auto-stopped');
});

test('idle does nothing when nothing is running', async () => {
  await chrome.idle.onStateChanged.emit('idle');
  assert.equal(mem[SK.log], undefined);
});

test('overrun alarm fires a notification while running', async () => {
  await send({ type: MSG.START_TIMER, task: 'Research' });
  await chrome.alarms.onAlarm.emit({ name: 'tt-overrun' });
  assert.equal(notifs.at(-1).title, '⏱ Task Overrun');
});

test('GET_STATE reflects the running timer (survives a "reload")', async () => {
  await send({ type: MSG.START_TIMER, task: 'Research' });
  const res = await send({ type: MSG.GET_STATE });
  assert.equal(res.activeTimer.task, 'Research');
});

test('OPEN_OPTIONS opens the options page', async () => {
  globalThis.__optsOpened = 0;
  await send({ type: MSG.OPEN_OPTIONS });
  assert.equal(globalThis.__optsOpened, 1);
});

test('settings change reschedules idle detection interval', async () => {
  mem[SK.idleMins] = '1';
  await chrome.storage.onChanged.emit({ [SK.idleMins]: { newValue: '1' } }, 'local');
  await flush(); // the worker's onChanged handler reschedules asynchronously
  assert.equal(idleInterval, 60); // 1 min -> 60s
});
