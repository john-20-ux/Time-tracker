// Desktop settings window. Same configuration as the extension options page
// (tasks/goals, overrun, idle, Sheets) minus the browser-only widget toggle.
// Storage goes through the chrome-shim to the main process.

import './chrome-shim.js';
import TRACKER_CSS from '../../src/ui/shared/styles.css';
import { DEFAULT_TASKS, SK } from '../../src/shared/constants.js';
import { getStorage, setStorage } from '../../src/core/store.js';

const OPTIONS_CSS = `
html,body{background:#f0ede8;margin:0;min-height:100vh;}
body{display:flex;justify-content:center;padding:28px 16px;}
#options-card{width:460px;max-width:100%;background:#faf9f7;border-radius:16px;padding:24px 26px;
  box-shadow:0 4px 6px rgba(0,0,0,.04),0 12px 40px rgba(0,0,0,.08);}
.options-title{font-size:18px;font-weight:600;color:#3a3530;margin-bottom:20px;}
.sett-section{margin-bottom:22px;}
.sett-label{font-size:13px;}
.notif-row label{font-size:12px;}
.idle-mins-label{font-size:11px;}
#options-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
  background:#3a3530;color:#fff;padding:8px 18px;border-radius:10px;font-size:12px;font-weight:500;
  opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;}
#options-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
`;

const base = document.createElement('style'); base.textContent = TRACKER_CSS; document.head.appendChild(base);
const ov = document.createElement('style'); ov.textContent = OPTIONS_CSS; document.head.appendChild(ov);

const $ = (id) => document.getElementById(id);
const state = { tasks: [] };

function toast(msg) {
  const t = $('options-toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 1800);
}

const saveTasks = () => setStorage(SK.tasks, JSON.stringify(state.tasks));

function renderTasks() {
  const wrap = $('task-list-edit');
  wrap.innerHTML = '';
  state.tasks.forEach((t, i) => {
    const row = document.createElement('div'); row.className = 'task-edit-row';
    const name = document.createElement('input');
    name.className = 'task-edit-name'; name.value = t.name;
    name.addEventListener('change', async () => { state.tasks[i].name = name.value; await saveTasks(); });
    const goal = document.createElement('input');
    goal.className = 'task-edit-goal'; goal.type = 'number'; goal.min = '0'; goal.max = '24'; goal.step = '0.5';
    goal.value = t.goal || 0; goal.title = 'Goal (hours)';
    goal.addEventListener('change', async () => { state.tasks[i].goal = parseFloat(goal.value) || 0; await saveTasks(); });
    const del = document.createElement('button');
    del.className = 'task-edit-del'; del.title = 'Remove'; del.textContent = '✕';
    del.addEventListener('click', async () => {
      if (state.tasks.length <= 1) { toast('Need at least one task'); return; }
      state.tasks.splice(i, 1); await saveTasks(); renderTasks();
    });
    row.append(name, goal, del);
    wrap.appendChild(row);
  });
}

$('add-task-btn').addEventListener('click', async () => {
  const v = $('new-task-input').value.trim(); if (!v) return;
  state.tasks.push({ name: v, goal: 0 }); $('new-task-input').value = '';
  await saveTasks(); renderTasks(); toast('✅ Task added');
});
$('new-task-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('add-task-btn').click(); });

$('notif-toggle').addEventListener('change', () => setStorage(SK.notifOn, String($('notif-toggle').checked)));
$('notif-mins').addEventListener('change', () => setStorage(SK.notifMins, String(parseInt($('notif-mins').value) || 90)));
$('idle-toggle').addEventListener('change', () => setStorage(SK.idleOn, String($('idle-toggle').checked)));
$('idle-mins').addEventListener('change', () => setStorage(SK.idleMins, String(parseInt($('idle-mins').value) || 5)));

function renderSheetsStatus(url) {
  const s = $('sheets-status');
  if (url) { s.textContent = '✅ URL configured'; s.className = 'sheets-status ok'; }
  else { s.textContent = 'Not configured'; s.className = 'sheets-status'; }
}
$('sheets-url').addEventListener('change', async () => {
  const url = $('sheets-url').value.trim();
  await setStorage(SK.sheetsUrl, url); renderSheetsStatus(url);
});
$('script-help-toggle').addEventListener('click', (e) => {
  e.preventDefault();
  const b = $('script-code-box');
  b.style.display = b.style.display === 'block' ? 'none' : 'block';
});

(async function init() {
  const raw = await getStorage(SK.tasks);
  try { state.tasks = (raw && raw !== 'null') ? JSON.parse(raw) : null; } catch (e) { state.tasks = null; }
  if (!Array.isArray(state.tasks) || state.tasks.length === 0) state.tasks = DEFAULT_TASKS.map((t) => ({ ...t }));
  renderTasks();
  $('notif-toggle').checked = (await getStorage(SK.notifOn)) === 'true';
  $('notif-mins').value = parseInt((await getStorage(SK.notifMins)) || '90', 10);
  $('idle-toggle').checked = (await getStorage(SK.idleOn)) === 'true';
  $('idle-mins').value = parseInt((await getStorage(SK.idleMins)) || '5', 10);
  const url = (await getStorage(SK.sheetsUrl)) || '';
  $('sheets-url').value = url;
  renderSheetsStatus(url);
})();
