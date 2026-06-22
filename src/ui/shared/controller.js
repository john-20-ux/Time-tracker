// Shared tracker UI controller. Wires behavior onto a root that already
// contains TRACKER_HTML — a ShadowRoot (floating widget) or the popup document.
// Widget-only chrome (drag, focus mode, collapse, saved position) is wired by
// the widget itself, not here. The service worker owns the running timer and
// the idle/overrun alerts; this controller sends START/STOP and reflects state.

import { DEFAULT_TASKS, TASK_COLORS, SK } from '../../shared/constants.js';
import { pad, fmt, fmtTime, todayStr, dateLabel } from '../../core/time.js';
import { cleanLabel, makeEntry, reviveEntry } from '../../core/model.js';
import { aggregateByTask, barPct, goalProgress, goalMap } from '../../core/summary.js';
import { buildCsv, buildTsv, buildSheetsPayload } from '../../core/export.js';
import { getStorage, setStorage } from '../../core/store.js';
import { appendEntry, clearToday } from '../../core/log.js';
import { MSG } from '../../shared/messages.js';

export function mountTrackerUI(root) {
  const $id = (id) => root.getElementById(id);

  const state = {
    tasks: [], currentTask: null, startTime: null, elapsed: 0,
    timerInterval: null, totalSeconds: 0, log: [],
    history: {},
    idleEnabled: false, idleMins: 5,
    notifEnabled: false, notifMins: 90,
    sheetsUrl: '', lastTask: null, summaryOffset: 0,
  };

  function showToast(msg, dur) {
    const t = $id('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), dur || 2500);
  }

  // ─── SAVE / LOAD ────────────────────────────────────────────────────────
  // save() persists settings + tasks only. The day log is owned by core/log.js.
  async function save() {
    try {
      await setStorage(SK.tasks, JSON.stringify(state.tasks));
      await setStorage(SK.idleOn, String(state.idleEnabled));
      await setStorage(SK.idleMins, String(state.idleMins));
      await setStorage(SK.notifOn, String(state.notifEnabled));
      await setStorage(SK.notifMins, String(state.notifMins));
      await setStorage(SK.sheetsUrl, state.sheetsUrl);
    } catch (e) {}
  }

  async function load() {
    try {
      const raw = await getStorage(SK.tasks);
      try {
        state.tasks = (raw && raw !== 'null') ? JSON.parse(raw) : null;
      } catch (e) { state.tasks = null; }
      if (!state.tasks || !Array.isArray(state.tasks) || state.tasks.length === 0) {
        state.tasks = DEFAULT_TASKS.map((t) => ({ ...t }));
      }

      const savedDate = await getStorage(SK.logDate);
      if (savedDate === todayStr()) {
        const rl = await getStorage(SK.log);
        state.log = rl ? JSON.parse(rl).map(reviveEntry) : [];
        state.totalSeconds = parseInt((await getStorage(SK.total)) || '0', 10);
      } else {
        // Archive the previous day's log, then start fresh and persist it.
        if (savedDate && await getStorage(SK.log)) {
          const oldLog = JSON.parse(await getStorage(SK.log)).map(reviveEntry);
          if (oldLog.length > 0) {
            const rh = await getStorage(SK.history);
            const hist = rh ? JSON.parse(rh) : {};
            hist[savedDate] = oldLog;
            await setStorage(SK.history, JSON.stringify(hist));
          }
        }
        state.log = []; state.totalSeconds = 0;
        await setStorage(SK.log, JSON.stringify([]));
        await setStorage(SK.total, '0');
        await setStorage(SK.logDate, todayStr());
      }
      const rh = await getStorage(SK.history);
      if (rh) {
        const raw2 = JSON.parse(rh);
        Object.keys(raw2).forEach((k) => { raw2[k] = raw2[k].map(reviveEntry); });
        state.history = raw2;
      }
      state.idleEnabled = (await getStorage(SK.idleOn)) === 'true';
      state.idleMins = parseInt((await getStorage(SK.idleMins)) || '5', 10);
      state.notifEnabled = (await getStorage(SK.notifOn)) === 'true';
      state.notifMins = parseInt((await getStorage(SK.notifMins)) || '90', 10);
      state.sheetsUrl = (await getStorage(SK.sheetsUrl)) || '';
    } catch (e) { state.tasks = DEFAULT_TASKS.map((t) => ({ ...t })); }
  }

  // ─── ELEMENTS ─────────────────────────────────────────────────────────────
  const el = {
    tracker: $id('tracker'), headerDate: $id('header-date'),
    focusTaskName: $id('focus-task-name'), focusTimer: $id('focus-timer'),
    settingsBtn: $id('settings-btn'), settingsPanel: $id('settings-panel'),
    clearBtn: $id('clear-btn'),
    activeTask: $id('active-task'), timerDisplay: $id('timer-display'),
    pulse: $id('pulse'), pulseText: $id('pulse-text'), startLabel: $id('start-time-label'),
    stopBtn: $id('stop-btn'), resumeBtn: $id('resume-btn'), resumeName: $id('resume-task-name'),
    taskSelect: $id('task-select'), totalDisplay: $id('total-display'),
    logBody: $id('log-body'), logCount: $id('log-count'),
    csvBtn: $id('csv-btn'), sheetsBtn: $id('sheets-btn'),
    noteModal: $id('note-modal'), noteInput: $id('note-input'),
    noteSkip: $id('note-skip'), noteSave: $id('note-save'),
    taskListEdit: $id('task-list-edit'), newTaskInput: $id('new-task-input'), addTaskBtn: $id('add-task-btn'),
    idleToggle: $id('idle-toggle'), idleMinsInput: $id('idle-mins'),
    notifToggle: $id('notif-toggle'), notifMinsInput: $id('notif-mins'),
    sheetsUrlInput: $id('sheets-url'), sheetsStatus: $id('sheets-status'),
    scriptHelpToggle: $id('script-help-toggle'), scriptCodeBox: $id('script-code-box'),
    historyPanel: $id('history-panel'),
    sumPrev: $id('sum-prev'), sumNext: $id('sum-next'),
    sumDateLabel: $id('sum-date-label'), sumTotal: $id('sum-total'), sumChart: $id('sum-chart'),
  };

  // ─── RENDER HELPERS ────────────────────────────────────────────────────────
  function rebuildSelect() {
    el.taskSelect.innerHTML = '<option value="">— Choose a task —</option>';
    state.tasks.forEach((t) => {
      const o = document.createElement('option'); o.value = t.name; o.textContent = t.name;
      el.taskSelect.appendChild(o);
    });
  }

  // Safe DOM builders — user data assigned as text/value, never parsed as HTML.
  function mkCell(cls, text, title) {
    const td = document.createElement('td');
    td.className = cls; td.textContent = text;
    if (title !== undefined) td.title = title;
    return td;
  }
  function mkSpan(cls, text, title) {
    const s = document.createElement('span');
    s.className = cls; if (text !== undefined) s.textContent = text;
    if (title !== undefined) s.title = title;
    return s;
  }

  function rebuildLogTable() {
    el.logBody.innerHTML = '';
    if (state.log.length === 0) {
      el.logBody.innerHTML = '<tr><td colspan="4"><div class="empty-log"><div class="empty-icon">📋</div>No entries yet</div></td></tr>';
      el.logCount.textContent = '0 entries';
      el.totalDisplay.textContent = '00:00:00';
      return;
    }
    [...state.log].reverse().forEach((e) => {
      const tr = document.createElement('tr');
      tr.appendChild(mkCell('task-name', e.task, e.task));
      tr.appendChild(mkCell('time-col', fmtTime(e.start)));
      tr.appendChild(mkCell('dur', e.duration));
      tr.appendChild(mkCell('note-cell', e.note || '—', e.note || ''));
      el.logBody.appendChild(tr);
    });
    el.logCount.textContent = `${state.log.length} entr${state.log.length === 1 ? 'y' : 'ies'}`;
    el.totalDisplay.textContent = fmt(state.totalSeconds);
  }

  function rebuildTaskListEdit() {
    el.taskListEdit.innerHTML = '';
    state.tasks.forEach((t, i) => {
      const row = document.createElement('div'); row.className = 'task-edit-row';
      const name = document.createElement('input');
      name.className = 'task-edit-name'; name.value = t.name; name.dataset.i = i;
      const goal = document.createElement('input');
      goal.className = 'task-edit-goal'; goal.type = 'number';
      goal.min = '0'; goal.max = '24'; goal.step = '0.5';
      goal.value = t.goal || 0; goal.dataset.gi = i; goal.title = 'Goal (hours)';
      const del = document.createElement('button');
      del.className = 'task-edit-del'; del.dataset.di = i; del.title = 'Remove'; del.textContent = '✕';
      row.append(name, goal, del);
      el.taskListEdit.appendChild(row);
    });
    el.taskListEdit.querySelectorAll('.task-edit-name').forEach((inp) => {
      inp.addEventListener('change', async () => { state.tasks[inp.dataset.i].name = inp.value; await save(); rebuildSelect(); });
    });
    el.taskListEdit.querySelectorAll('.task-edit-goal').forEach((inp) => {
      inp.addEventListener('change', async () => { state.tasks[parseInt(inp.dataset.gi)].goal = parseFloat(inp.value) || 0; await save(); });
    });
    el.taskListEdit.querySelectorAll('.task-edit-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (state.tasks.length <= 1) { showToast('Need at least one task'); return; }
        state.tasks.splice(parseInt(btn.dataset.di), 1); await save(); rebuildSelect(); rebuildTaskListEdit();
      });
    });
  }

  // ─── TIMER ──────────────────────────────────────────────────────────────────
  // Render the UI for a given active timer ({ task, startTime } | null).
  function applyActive(activeTimer) {
    clearInterval(state.timerInterval);
    if (activeTimer) {
      state.currentTask = activeTimer.task;
      state.startTime = new Date(activeTimer.startTime);
      el.activeTask.textContent = activeTimer.task;
      el.pulse.classList.add('on');
      el.pulseText.textContent = 'Tracking';
      el.startLabel.textContent = 'Started ' + fmtTime(state.startTime);
      el.stopBtn.disabled = false;
      el.resumeBtn.style.display = 'none';
      el.focusTaskName.textContent = cleanLabel(activeTimer.task);
      el.taskSelect.value = activeTimer.task;
      tickDisplay();
      state.timerInterval = setInterval(tickDisplay, 1000);
    } else {
      state.currentTask = null;
      state.startTime = null;
      state.elapsed = 0;
      el.activeTask.textContent = 'No active task';
      el.timerDisplay.textContent = '00:00:00';
      el.pulse.classList.remove('on');
      el.pulseText.textContent = 'Idle';
      el.startLabel.textContent = '';
      el.stopBtn.disabled = true;
      el.focusTaskName.textContent = 'Idle';
      el.focusTimer.textContent = '00:00:00';
      el.taskSelect.value = '';
    }
  }

  // Recompute elapsed from the worker-owned startTime (not a local counter).
  function tickDisplay() {
    if (!state.startTime) return;
    state.elapsed = Math.max(0, Math.floor((Date.now() - state.startTime.getTime()) / 1000));
    const display = fmt(state.elapsed);
    el.timerDisplay.textContent = display;
    el.focusTimer.textContent = display;
  }

  async function startTimer(taskName) {
    const res = await chrome.runtime.sendMessage({ type: MSG.START_TIMER, task: taskName });
    applyActive(res && res.activeTimer ? res.activeTimer : { task: taskName, startTime: Date.now() });
  }

  async function stopTimer() {
    const res = await chrome.runtime.sendMessage({ type: MSG.STOP_TIMER });
    applyActive(null);
    if (!res || !res.stopped) return null;
    const { task, startTime, endTime } = res.stopped;
    state.lastTask = task;
    const elapsedSec = Math.max(0, Math.round((endTime - startTime) / 1000));
    return makeEntry({ task, start: new Date(startTime), end: new Date(endTime), elapsedSec });
  }

  async function addLogRow(entry) {
    await appendEntry(entry);
    await reloadLog();
    if (el.resumeName) el.resumeName.textContent = (state.lastTask || '');
    if (el.resumeBtn) el.resumeBtn.style.display = 'block';
  }

  // Reload the day log + history from storage and refresh visible views.
  async function reloadLog() {
    const savedDate = await getStorage(SK.logDate);
    if (savedDate === todayStr()) {
      const rl = await getStorage(SK.log);
      state.log = rl ? JSON.parse(rl).map(reviveEntry) : [];
      state.totalSeconds = parseInt((await getStorage(SK.total)) || '0', 10);
    } else {
      state.log = []; state.totalSeconds = 0;
    }
    const rh = await getStorage(SK.history);
    if (rh) {
      const raw2 = JSON.parse(rh);
      Object.keys(raw2).forEach((k) => { raw2[k] = raw2[k].map(reviveEntry); });
      state.history = raw2;
    }
    rebuildLogTable();
    if ($id('tab-history')?.classList.contains('active')) buildHistory();
    if ($id('tab-summary')?.classList.contains('active')) buildSummary();
  }

  // ─── NOTE MODAL ─────────────────────────────────────────────────────────────
  let pendingEntry = null, pendingCb = null;
  function openNoteModal(entry, cb) {
    pendingEntry = entry; pendingCb = cb;
    el.noteInput.value = '';
    el.noteModal.classList.add('open');
    el.noteInput.focus();
  }
  el.noteSkip.addEventListener('click', () => {
    el.noteModal.classList.remove('open');
    if (pendingEntry && pendingCb) { pendingCb(); pendingEntry = null; pendingCb = null; }
  });
  el.noteSave.addEventListener('click', () => {
    if (pendingEntry) pendingEntry.note = el.noteInput.value.trim();
    el.noteModal.classList.remove('open');
    if (pendingEntry && pendingCb) { pendingCb(); pendingEntry = null; pendingCb = null; }
  });

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  function buildSummary() {
    const d = new Date(); d.setDate(d.getDate() - state.summaryOffset);
    const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    el.sumDateLabel.textContent = state.summaryOffset === 0 ? 'Today' : dateLabel(ds);
    const entries = state.summaryOffset === 0 ? state.log : (state.history[ds] || []);
    if (entries.length === 0) {
      el.sumTotal.textContent = '00:00:00';
      el.sumChart.innerHTML = '<div class="summary-empty">No data for this day</div>';
      return;
    }
    const { total, max, sorted } = aggregateByTask(entries);
    el.sumTotal.textContent = fmt(total);
    const goals = goalMap(state.tasks);
    el.sumChart.innerHTML = '';
    sorted.forEach(([task, sec], i) => {
      const pct = barPct(sec, max);
      const progress = goalProgress(sec, goals[task] || 0);
      const color = TASK_COLORS[i % TASK_COLORS.length];
      const row = document.createElement('div'); row.className = 'chart-bar-row';

      const label = document.createElement('div');
      label.className = 'chart-label'; label.title = task; label.textContent = cleanLabel(task);

      const track = document.createElement('div'); track.className = 'chart-bar-track';
      const fill = document.createElement('div'); fill.className = 'chart-bar-fill';
      fill.style.width = pct + '%'; fill.style.background = color;
      if (progress) {
        const badge = mkSpan('chart-bar-goal');
        if (progress.done) { badge.style.background = 'rgba(74,124,111,.7)'; badge.textContent = '✓ Done'; }
        else { badge.textContent = progress.pct + '%'; }
        fill.appendChild(badge);
      }
      track.appendChild(fill);

      const time = document.createElement('div'); time.className = 'chart-bar-time'; time.textContent = fmt(sec);
      row.append(label, track, time);
      el.sumChart.appendChild(row);
    });
  }
  el.sumPrev.addEventListener('click', () => { state.summaryOffset++; buildSummary(); });
  el.sumNext.addEventListener('click', () => { if (state.summaryOffset > 0) { state.summaryOffset--; buildSummary(); } });

  // ─── HISTORY ────────────────────────────────────────────────────────────────
  function buildHistory() {
    rebuildLogTable();
    el.historyPanel.innerHTML = '';
    const days = Object.keys(state.history).filter((k) => k !== todayStr()).sort().reverse();
    if (days.length === 0) {
      el.historyPanel.innerHTML = '<div class="history-empty">No past logs yet</div>';
      return;
    }
    days.forEach((ds) => {
      const entries = state.history[ds] || [];
      const totalSec = entries.reduce((a, e) => a + (e.durationSec || 0), 0);
      const wrap = document.createElement('div'); wrap.className = 'hist-day';
      const hdr = document.createElement('div'); hdr.className = 'hist-day-header';
      hdr.append(mkSpan('hist-day-date', dateLabel(ds)), mkSpan('hist-day-total', fmt(totalSec)));
      const list = document.createElement('div'); list.className = 'hist-day-entries';
      entries.forEach((e) => {
        const row = document.createElement('div'); row.className = 'hist-entry';
        row.append(
          mkSpan('hist-entry-task', e.task, e.task),
          mkSpan('hist-entry-note', e.note ? '📝' : '', e.note || ''),
          mkSpan('hist-entry-time', fmtTime(e.start)),
          mkSpan('hist-entry-dur', e.duration),
        );
        list.appendChild(row);
      });
      hdr.addEventListener('click', () => list.classList.toggle('open'));
      wrap.appendChild(hdr); wrap.appendChild(list);
      el.historyPanel.appendChild(wrap);
    });
  }

  // ─── TABS ─────────────────────────────────────────────────────────────────
  root.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      root.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $id('tab-' + tab).classList.add('active');
      if (tab === 'summary') { state.summaryOffset = 0; buildSummary(); }
      if (tab === 'history') buildHistory();
    });
  });

  // ─── EVENTS ─────────────────────────────────────────────────────────────────
  el.taskSelect.addEventListener('change', async () => {
    const v = el.taskSelect.value; if (!v) return;
    if (state.currentTask) {
      const e = await stopTimer();
      if (e) { openNoteModal(e, async () => { await addLogRow(e); await startTimer(v); }); return; }
    }
    await startTimer(v);
  });

  el.stopBtn.addEventListener('click', async () => {
    const e = await stopTimer(); if (e) { el.taskSelect.value = ''; openNoteModal(e, () => addLogRow(e)); }
  });

  el.resumeBtn.addEventListener('click', async () => {
    if (!state.lastTask) return;
    el.taskSelect.value = state.lastTask;
    await startTimer(state.lastTask); el.resumeBtn.style.display = 'none';
  });

  el.clearBtn.addEventListener('click', async () => {
    if (!confirm("Clear today's log?")) return;
    if (state.currentTask) { await stopTimer(); el.taskSelect.value = ''; }
    await clearToday();
    await reloadLog(); showToast('🗑 Log cleared');
  });

  el.settingsBtn.addEventListener('click', () => {
    const o = el.settingsPanel.classList.toggle('open');
    el.settingsBtn.classList.toggle('active-btn', o);
    if (o) { rebuildTaskListEdit(); el.tracker.classList.remove('collapsed'); el.tracker.classList.remove('focus-mode'); }
  });

  el.scriptHelpToggle.addEventListener('click', (e) => {
    e.preventDefault(); const b = el.scriptCodeBox;
    b.style.display = b.style.display === 'none' ? 'block' : 'none';
  });

  // Settings save handlers
  el.addTaskBtn.addEventListener('click', async () => {
    const v = el.newTaskInput.value.trim(); if (!v) return;
    state.tasks.push({ name: v, goal: 0 }); el.newTaskInput.value = '';
    await save(); rebuildSelect(); rebuildTaskListEdit(); showToast('✅ Task added');
  });
  el.newTaskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.addTaskBtn.click(); });

  el.idleToggle.addEventListener('change', async () => { state.idleEnabled = el.idleToggle.checked; await save(); });
  el.idleMinsInput.addEventListener('change', async () => { state.idleMins = parseInt(el.idleMinsInput.value) || 5; await save(); });
  el.notifToggle.addEventListener('change', async () => {
    // The worker reschedules the overrun alarm when these settings change.
    state.notifEnabled = el.notifToggle.checked; await save();
  });
  el.notifMinsInput.addEventListener('change', async () => { state.notifMins = parseInt(el.notifMinsInput.value) || 90; await save(); });
  el.sheetsUrlInput.addEventListener('change', async () => {
    state.sheetsUrl = el.sheetsUrlInput.value.trim(); await save();
    if (state.sheetsUrl) { el.sheetsStatus.textContent = '✅ URL configured'; el.sheetsStatus.className = 'sheets-status ok'; }
    else { el.sheetsStatus.textContent = 'Not configured'; el.sheetsStatus.className = 'sheets-status'; }
  });

  // ─── EXPORT ─────────────────────────────────────────────────────────────────
  el.csvBtn.addEventListener('click', () => {
    if (state.log.length === 0) { showToast('No entries to export'); return; }
    const csv = buildCsv(state.log);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `timesheet-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(a.href);
    showToast('📥 CSV downloaded');
  });

  el.sheetsBtn.addEventListener('click', async () => {
    if (state.log.length === 0) { showToast('No entries to push'); return; }
    if (state.sheetsUrl) {
      el.sheetsBtn.innerHTML = '<span class="btn-icon">📊</span> Pushing…'; el.sheetsBtn.disabled = true;
      try {
        const payload = buildSheetsPayload(state.log);
        const res = await fetch(state.sheetsUrl, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain' } });
        const txt = await res.text();
        if (txt === 'OK') showToast('📊 Pushed to Google Sheets!', 3500); else throw new Error(txt);
      } catch (err) { showToast('❌ Push failed — check Apps Script URL', 4000); console.error(err); }
      finally { el.sheetsBtn.innerHTML = '<span class="btn-icon">📊</span> Push to Sheets'; el.sheetsBtn.disabled = false; }
    } else {
      const tsv = buildTsv(state.log);
      navigator.clipboard.writeText(tsv).then(() => {
        showToast('📊 Data copied — paste into Google Sheets', 3500);
        window.open('https://sheets.new', '_blank');
      }).catch(() => { window.open('https://sheets.new', '_blank'); });
    }
  });

  // ─── CROSS-TAB / WORKER SYNC ─────────────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (SK.activeTimer in changes) applyActive(changes[SK.activeTimer].newValue || null);
    if (SK.log in changes || SK.total in changes || SK.history in changes) reloadLog();
  });

  // ─── INIT ─────────────────────────────────────────────────────────────────
  (async function () {
    await load();
    el.headerDate.textContent = todayStr();
    rebuildSelect(); rebuildLogTable();
    el.idleToggle.checked = state.idleEnabled; el.idleMinsInput.value = state.idleMins;
    el.notifToggle.checked = state.notifEnabled; el.notifMinsInput.value = state.notifMins;
    el.sheetsUrlInput.value = state.sheetsUrl;
    if (state.sheetsUrl) { el.sheetsStatus.textContent = '✅ URL configured'; el.sheetsStatus.className = 'sheets-status ok'; }
    try {
      const st = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
      applyActive(st && st.activeTimer ? st.activeTimer : null);
    } catch (e) {}
  })();
}
