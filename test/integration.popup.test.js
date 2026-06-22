// DOM smoke test for the popup. Bundles the real popup entry (esbuild), mounts
// it in jsdom against a simulated chrome + worker, and verifies it renders and
// that starting/stopping a task drives the worker and reflects its state.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';
import { JSDOM } from 'jsdom';
import { SK } from '../src/shared/constants.js';

const mem = {};
let window;
const sentTypes = [];

const flush = () => new Promise((r) => setTimeout(r, 10));

before(async () => {
  const { outputFiles } = await esbuild.build({
    entryPoints: ['src/ui/popup/popup.js'],
    bundle: true,
    format: 'iife',
    write: false,
    loader: { '.css': 'text' },
    logLevel: 'silent',
  });
  const bundle = outputFiles[0].text;

  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  window = dom.window;

  // Simulated worker: tracks an active timer in `mem` like the real one.
  window.chrome = {
    storage: {
      local: {
        get: async (keys) => {
          const o = {};
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in mem) o[k] = mem[k]; });
          return o;
        },
        set: async (o) => { Object.assign(mem, o); },
        remove: async (keys) => { (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete mem[k]); },
      },
      onChanged: { addListener() {} },
    },
    runtime: {
      sendMessage: async (msg) => {
        sentTypes.push(msg.type);
        if (msg.type === 'GET_STATE') return { activeTimer: mem.__active || null };
        if (msg.type === 'START_TIMER') { mem.__active = { task: msg.task, startTime: Date.now() }; return { activeTimer: mem.__active }; }
        if (msg.type === 'STOP_TIMER') {
          const a = mem.__active; mem.__active = null;
          return { stopped: a ? { task: a.task, startTime: a.startTime, endTime: Date.now() } : null };
        }
        return {};
      },
      onMessage: { addListener() {} },
    },
  };

  window.eval(bundle);
  await flush();
});

test('popup renders the tracker with default tasks', () => {
  assert.ok(window.document.getElementById('tracker'), '#tracker rendered');
  const opts = window.document.getElementById('task-select').options;
  assert.ok(opts.length > 1, 'tasks populated into the select');
});

test('selecting a task sends START_TIMER and shows it tracking', async () => {
  const select = window.document.getElementById('task-select');
  select.value = select.options[1].value; // first real task
  select.dispatchEvent(new window.Event('change'));
  await flush();
  assert.ok(sentTypes.includes('START_TIMER'), 'START_TIMER sent to worker');
  assert.equal(window.document.getElementById('pulse-text').textContent, 'Tracking');
  assert.equal(window.document.getElementById('stop-btn').disabled, false);
});

test('stop sends STOP_TIMER and opens the note modal', async () => {
  window.document.getElementById('stop-btn').click();
  await flush();
  assert.ok(sentTypes.includes('STOP_TIMER'), 'STOP_TIMER sent to worker');
  assert.ok(
    window.document.getElementById('note-modal').classList.contains('open'),
    'note modal opened after stop',
  );
});
