// DOM smoke test for the options page. Bundles the real options entry, mounts
// it in jsdom against a simulated chrome.storage, and verifies it renders the
// task editor and persists edits to the same storage keys the rest of the app
// observes.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { SK } from '../src/shared/constants.js';

const mem = {};
let window;
const flush = () => new Promise((r) => setTimeout(r, 10));

before(async () => {
  const { outputFiles } = await esbuild.build({
    entryPoints: ['src/ui/options/options.js'],
    bundle: true,
    format: 'iife',
    write: false,
    loader: { '.css': 'text' },
    logLevel: 'silent',
  });
  const bundle = outputFiles[0].text;
  const html = readFileSync('src/ui/options/options.html', 'utf8');

  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
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
      onChanged: { addListener() {} },
    },
  };

  window.eval(bundle);
  await flush();
});

test('options renders the task editor with default tasks', () => {
  const rows = window.document.querySelectorAll('#task-list-edit .task-edit-row');
  assert.ok(rows.length >= 1, 'task rows rendered');
});

test('adding a task persists it to storage', async () => {
  window.document.getElementById('new-task-input').value = 'New Task';
  window.document.getElementById('add-task-btn').click();
  await flush();
  const tasks = JSON.parse(mem[SK.tasks]);
  assert.ok(tasks.some((t) => t.name === 'New Task'), 'task saved to SK.tasks');
});

test('toggling idle persists the setting', async () => {
  const t = window.document.getElementById('idle-toggle');
  t.checked = true;
  t.dispatchEvent(new window.Event('change'));
  await flush();
  assert.equal(mem[SK.idleOn], 'true');
});

test('entering a Sheets URL persists and shows configured', async () => {
  const u = window.document.getElementById('sheets-url');
  u.value = 'https://example.com/exec';
  u.dispatchEvent(new window.Event('change'));
  await flush();
  assert.equal(mem[SK.sheetsUrl], 'https://example.com/exec');
  assert.match(window.document.getElementById('sheets-status').textContent, /configured/);
});
