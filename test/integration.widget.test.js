// DOM smoke test for the widget. Bundles the real content script (esbuild),
// mounts it in jsdom against a simulated chrome, and verifies it renders — and
// that user-controlled task/note text is rendered inert (XSS regression guard).

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';
import { JSDOM } from 'jsdom';
import { SK } from '../src/shared/constants.js';
import { todayStr } from '../src/core/time.js';

const mem = {};
const onChangedCbs = [];
let window;

const flush = () => new Promise((r) => setTimeout(r, 10));

before(async () => {
  const { outputFiles } = await esbuild.build({
    entryPoints: ['src/ui/widget/content.js'],
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
      onChanged: { addListener: (cb) => onChangedCbs.push(cb) },
    },
    runtime: {
      sendMessage: async (msg) => (msg.type === 'GET_STATE' ? { activeTimer: null } : {}),
      onMessage: { addListener() {} },
    },
  };

  window.eval(bundle);
  await flush(); // let the widget's async init() settle
});

test('widget mounts a shadow-root tracker', () => {
  const host = window.document.getElementById('time-tracker-ext-host');
  assert.ok(host, 'shadow host appended');
  assert.ok(host.shadowRoot.getElementById('tracker'), '#tracker rendered');
});

test('log entries render, and malicious task/note text is inert (no XSS)', async () => {
  const payloadTask = '<img src=x onerror="window.__xss=1">';
  const payloadNote = '<script>window.__xss=1</script>';
  const now = new Date().toISOString();
  mem[SK.logDate] = todayStr();
  mem[SK.log] = JSON.stringify([
    { task: payloadTask, start: now, end: now, duration: '00:10:00', durationSec: 600, note: payloadNote, date: todayStr() },
  ]);
  // Simulate the storage write notifying the widget (as the worker/another tab would).
  onChangedCbs.forEach((cb) => cb({ [SK.log]: { newValue: mem[SK.log] } }, 'local'));
  await flush();

  const sr = window.document.getElementById('time-tracker-ext-host').shadowRoot;
  const cell = sr.querySelector('.task-name');
  assert.ok(cell, 'log row rendered');
  assert.equal(cell.textContent, payloadTask, 'task shown as literal text');
  assert.equal(cell.querySelector('img'), null, 'task not parsed into elements');
  assert.equal(sr.querySelector('.note-cell script'), null, 'note not parsed into elements');
  assert.equal(window.__xss, undefined, 'no injected script executed');
});
