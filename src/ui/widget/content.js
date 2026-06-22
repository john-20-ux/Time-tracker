import { DEFAULT_TASKS, TASK_COLORS, SK } from '../../shared/constants.js';
import { pad, fmt, fmtTime, todayStr, dateLabel } from '../../core/time.js';
import { cleanLabel, makeEntry } from '../../core/model.js';
import { aggregateByTask, barPct, goalProgress, goalMap } from '../../core/summary.js';
import { buildCsv, buildTsv, buildSheetsPayload } from '../../core/export.js';
import { getStorage, setStorage } from '../../core/store.js';
import { MSG } from '../../shared/messages.js';

const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

const shadowHost = document.createElement('div');
shadowHost.id = 'time-tracker-ext-host';
document.body.appendChild(shadowHost);

const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

const style = document.createElement('style');
style.textContent = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:#f0ede8;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#3a3530;}
.demo-bg{text-align:center;color:#b0a89e;font-size:13px;line-height:1.8;user-select:none;}
.demo-bg h2{font-size:22px;font-weight:300;color:#c8bfb5;margin-bottom:8px;}

/* ── WIDGET ── */
#tracker{position:fixed;bottom:28px;right:28px;width:340px;background:#faf9f7;border-radius:18px;
  box-shadow:0 4px 6px rgba(0,0,0,.04),0 12px 40px rgba(0,0,0,.10),0 0 0 1px rgba(0,0,0,.05);
  overflow:hidden;z-index:99999;user-select:none;transition:box-shadow .2s,width .25s,border-radius .25s;}
#tracker:hover{box-shadow:0 4px 6px rgba(0,0,0,.05),0 16px 48px rgba(0,0,0,.13),0 0 0 1px rgba(0,0,0,.06);}
#tracker.dragging{box-shadow:0 20px 60px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.08);transition:none;}
#tracker.collapsed #body,#tracker.collapsed #settings-panel,#tracker.collapsed #tab-bar{display:none;}

/* FOCUS MODE */
#tracker.focus-mode{width:220px;border-radius:40px;}
#tracker.focus-mode #body,#tracker.focus-mode #settings-panel,#tracker.focus-mode #tab-bar{display:none;}
#focus-pill{display:none;padding:10px 16px;align-items:center;gap:10px;}
#tracker.focus-mode #focus-pill{display:flex;}
#tracker.focus-mode #header{border-radius:40px;padding:10px 14px;}
#tracker.focus-mode .header-icon{display:none;}
#tracker.focus-mode .header-title{display:none;}
#tracker.focus-mode .header-subtitle{display:none;}
#tracker.focus-mode #settings-btn,
#tracker.focus-mode #clear-btn,
#tracker.focus-mode #collapse-btn{display:none;}
#focus-task-name{font-size:11px;font-weight:600;color:#3a3530;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#focus-timer{font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:#3a3530;letter-spacing:.5px;}

/* HEADER */
#header{background:#4a7c6f;padding:13px 16px;display:flex;align-items:center;gap:10px;cursor:grab;border-radius:18px 18px 0 0;}
#header:active{cursor:grabbing;}
.header-icon{width:30px;height:30px;background:rgba(255,255,255,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
.header-title{font-size:13px;font-weight:600;color:#fff;letter-spacing:.2px;}
.header-subtitle{font-size:10px;color:rgba(255,255,255,.65);margin-top:1px;}
.header-btns{display:flex;gap:4px;flex-shrink:0;}
.hbtn{background:rgba(255,255,255,.12);border:none;color:rgba(255,255,255,.85);font-size:13px;width:28px;height:28px;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
.hbtn:hover{background:rgba(255,255,255,.22);}
.hbtn.active-btn{background:rgba(255,255,255,.28);}

/* TAB BAR */
#tab-bar{display:flex;border-bottom:1px solid #ebe7e2;background:#faf9f7;}
.tab-btn{flex:1;padding:9px 0;font-size:11px;font-weight:500;color:#a09890;background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;}
.tab-btn:hover{color:#6b6158;}
.tab-btn.active{color:#4a7c6f;border-bottom-color:#4a7c6f;}

/* BODY / TABS */
#body{max-height:420px;overflow-y:auto;}
.tab-panel{display:none;padding:0 16px 16px;}
.tab-panel.active{display:block;}

/* ACTIVE TASK AREA */
.active-area{padding:14px 0 10px;text-align:center;}
#active-task{font-size:12px;font-weight:500;color:#6b6158;margin-bottom:6px;}
#timer-display{font-family:'DM Mono',monospace;font-size:32px;font-weight:500;color:#3a3530;letter-spacing:1px;}
.pulse-dot{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;}
#pulse{width:7px;height:7px;border-radius:50%;background:#c4bdb5;display:inline-block;}
#pulse.on{background:#4a7c6f;animation:pulse-glow 1.5s infinite;}
@keyframes pulse-glow{0%,100%{box-shadow:0 0 0 0 rgba(74,124,111,.4)}50%{box-shadow:0 0 0 6px rgba(74,124,111,0)}}
#pulse-text{font-size:10px;color:#a09890;}
#start-time-label{font-size:10px;color:#b0a89e;margin-top:3px;}
#stop-btn{margin-top:8px;background:#e8e3dd;border:none;color:#6b6158;font-size:11px;font-weight:500;padding:6px 18px;border-radius:8px;cursor:pointer;transition:background .15s;}
#stop-btn:hover:not(:disabled){background:#ddd7d0;}
#stop-btn:disabled{opacity:.4;cursor:default;}

/* RESUME */
#resume-btn{display:none;width:100%;padding:8px 14px;margin-bottom:8px;font-size:11px;font-weight:500;color:#4a7c6f;background:none;border:2px dashed #c8ddd7;border-radius:10px;cursor:pointer;transition:background .15s,border-color .15s;text-align:left;}
#resume-btn:hover{background:#edf5f2;border-color:#4a7c6f;}

/* DROPDOWN */
.select-wrap{position:relative;margin-bottom:8px;}
.select-label{font-size:10px;font-weight:500;color:#a09890;margin-bottom:5px;letter-spacing:.3px;text-transform:uppercase;}
#task-select{width:100%;padding:10px 32px 10px 12px;border:1px solid #e0dbd5;border-radius:10px;background:#fff;font-size:12px;font-family:'DM Sans',sans-serif;color:#3a3530;appearance:none;cursor:pointer;transition:border-color .15s;}
#task-select:focus{outline:none;border-color:#4a7c6f;}
.select-arrow{position:absolute;right:12px;bottom:11px;font-size:12px;color:#a09890;pointer-events:none;}

/* TOTAL ROW */
#total-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #ebe7e2;margin-top:4px;}
.total-label{font-size:11px;font-weight:500;color:#6b6158;}
#total-display{font-family:'DM Mono',monospace;font-size:14px;font-weight:500;color:#4a7c6f;}

/* EXPORT */
.export-row{display:flex;gap:8px;margin-top:8px;}
.exp-btn{flex:1;padding:9px 0;border:1px solid #e0dbd5;border-radius:10px;background:#fff;font-size:11px;font-weight:500;color:#6b6158;cursor:pointer;transition:background .15s,border-color .15s;display:flex;align-items:center;justify-content:center;gap:5px;}
.exp-btn:hover{background:#f5f3f0;border-color:#ccc7c0;}
.exp-btn.sheets{color:#4a7c6f;border-color:#c8ddd7;}
.exp-btn.sheets:hover{background:#edf5f2;}
.btn-icon{font-size:13px;}

/* DIVIDER */
.divider{height:1px;background:#ebe7e2;margin:10px 0;}

/* ── HISTORY TAB ── */
.history-section-title{font-size:12px;font-weight:600;color:#4a7c6f;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
.history-section-title .badge{font-size:10px;font-weight:500;color:#a09890;background:#f0ede8;padding:2px 7px;border-radius:6px;}

/* Today's log table in history */
.log-table{width:100%;border-collapse:collapse;font-size:11px;}
.log-table thead{position:sticky;top:0;z-index:1;}
.log-table th{text-align:left;font-size:10px;font-weight:500;color:#a09890;padding:6px 8px;background:#faf9f7;border-bottom:1px solid #ebe7e2;letter-spacing:.3px;text-transform:uppercase;}
.log-table td{padding:7px 8px;border-bottom:1px solid #f0ede8;color:#6b6158;vertical-align:top;}
.log-table tr:last-child td{border-bottom:none;}
.log-table .dur{font-family:'DM Mono',monospace;color:#4a7c6f;font-weight:500;font-size:11px;white-space:nowrap;}
.log-table .task-name{font-weight:500;color:#3a3530;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.log-table .time-col{font-size:10px;color:#b0a89e;white-space:nowrap;}
.log-table .note-cell{font-size:10px;color:#a09890;font-style:italic;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.empty-log{text-align:center;padding:24px 0;color:#c4bdb5;}
.empty-icon{font-size:24px;margin-bottom:6px;}

/* Past days in history */
.hist-day{margin-top:14px;border:1px solid #ebe7e2;border-radius:10px;overflow:hidden;}
.hist-day-header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f5f3f0;cursor:pointer;transition:background .15s;}
.hist-day-header:hover{background:#ebe7e2;}
.hist-day-date{font-size:11px;font-weight:600;color:#3a3530;}
.hist-day-total{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#4a7c6f;}
.hist-day-entries{display:none;padding:6px 10px;}
.hist-day-entries.open{display:block;}
.hist-entry{display:flex;align-items:center;gap:8px;padding:5px 4px;border-bottom:1px solid #f5f3f0;font-size:11px;}
.hist-entry:last-child{border-bottom:none;}
.hist-entry-task{flex:1;font-weight:500;color:#3a3530;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hist-entry-time{font-size:10px;color:#b0a89e;}
.hist-entry-dur{font-family:'DM Mono',monospace;font-size:11px;color:#4a7c6f;font-weight:500;flex-shrink:0;}
.hist-entry-note{font-size:9px;color:#a09890;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;}
.history-empty{text-align:center;padding:20px 0;color:#c4bdb5;font-size:12px;}

/* ── SUMMARY TAB ── */
.summary-date-row{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px;}
.date-nav-btn{background:none;border:1px solid #e0dbd5;border-radius:6px;width:28px;height:28px;font-size:16px;color:#6b6158;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
.date-nav-btn:hover{background:#f0ede8;}
.summary-date-label{font-size:12px;font-weight:600;color:#3a3530;min-width:100px;text-align:center;}
.summary-total-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f0ede8;border-radius:10px;margin-bottom:12px;}
.summary-total-lbl{font-size:11px;font-weight:500;color:#6b6158;}
.summary-total-val{font-family:'DM Mono',monospace;font-size:16px;font-weight:600;color:#4a7c6f;}
.chart-wrap{display:flex;flex-direction:column;gap:8px;}
.chart-bar-row{display:flex;align-items:center;gap:8px;}
.chart-label{font-size:10px;font-weight:500;color:#6b6158;width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;text-align:right;}
.chart-bar-track{flex:1;height:18px;background:#f0ede8;border-radius:6px;overflow:hidden;position:relative;}
.chart-bar-fill{height:100%;border-radius:6px;transition:width .4s ease;}
.chart-bar-time{font-family:'DM Mono',monospace;font-size:10px;color:#6b6158;flex-shrink:0;width:58px;}
.chart-bar-goal{position:absolute;right:6px;top:2px;font-size:8px;font-weight:600;color:#fff;background:rgba(0,0,0,.2);padding:1px 5px;border-radius:4px;}
.summary-empty{text-align:center;padding:20px 0;color:#c4bdb5;font-size:12px;}

/* ── SETTINGS ── */
#settings-panel{display:none;padding:14px 16px;border-bottom:1px solid #ebe7e2;background:#f9f7f4;max-height:320px;overflow-y:auto;}
#settings-panel.open{display:block;}
.sett-section{margin-bottom:14px;}
.sett-section:last-child{margin-bottom:0;}
.sett-label{font-size:11px;font-weight:600;color:#4a7c6f;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
.task-edit-row{display:flex;align-items:center;gap:6px;margin-bottom:5px;}
.task-edit-name{flex:1;padding:5px 8px;border:1px solid #e0dbd5;border-radius:6px;font-size:11px;font-family:'DM Sans',sans-serif;color:#3a3530;background:#fff;}
.task-edit-goal{width:48px;padding:5px 6px;border:1px solid #e0dbd5;border-radius:6px;font-size:11px;font-family:'DM Mono',monospace;color:#4a7c6f;text-align:center;background:#fff;}
.task-edit-del{background:none;border:none;font-size:14px;cursor:pointer;color:#c4bdb5;padding:2px 4px;border-radius:4px;transition:color .15s;}
.task-edit-del:hover{color:#d45;}
.add-task-row{display:flex;gap:6px;margin-top:6px;}
.add-task-input{flex:1;padding:6px 8px;border:1px solid #e0dbd5;border-radius:6px;font-size:11px;font-family:'DM Sans',sans-serif;color:#3a3530;}
.add-task-btn{background:#4a7c6f;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;transition:background .15s;}
.add-task-btn:hover{background:#3d6b5f;}
.notif-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.notif-row label{font-size:11px;color:#6b6158;}
.toggle-switch{position:relative;width:36px;height:20px;cursor:pointer;}
.toggle-switch input{display:none;}
.toggle-track{width:36px;height:20px;border-radius:10px;background:#d9d4cd;transition:background .2s;position:absolute;top:0;left:0;}
.toggle-track::after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:2px;left:2px;transition:transform .2s;}
.toggle-switch input:checked+.toggle-track{background:#4a7c6f;}
.toggle-switch input:checked+.toggle-track::after{transform:translateX(16px);}
.idle-mins-wrap{display:flex;align-items:center;gap:8px;margin-top:4px;}
.idle-mins-label{font-size:10px;color:#a09890;flex:1;}
.idle-mins-input{width:52px;padding:4px 6px;border:1px solid #e0dbd5;border-radius:6px;font-size:11px;font-family:'DM Mono',monospace;text-align:center;color:#3a3530;}
.sheets-input-wrap{margin-top:6px;}
.sheets-url-input{width:100%;padding:7px 8px;border:1px solid #e0dbd5;border-radius:6px;font-size:10px;font-family:'DM Mono',monospace;color:#3a3530;}
.sheets-status{font-size:10px;margin-top:4px;color:#a09890;}
.sheets-status.ok{color:#4a7c6f;}
.script-help{font-size:10px;color:#4a7c6f;cursor:pointer;text-decoration:underline;margin-top:6px;display:inline-block;}
.script-code-box{display:none;margin-top:6px;padding:8px;background:#2d2d2d;border-radius:8px;font-size:9px;font-family:'DM Mono',monospace;color:#c4c4c4;white-space:pre-wrap;max-height:200px;overflow-y:auto;user-select:text;}

/* ── NOTE MODAL ── */
#note-modal{display:none;position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);align-items:center;justify-content:center;}
#note-modal.open{display:flex;}
.note-card{background:#faf9f7;border-radius:14px;padding:20px;width:300px;box-shadow:0 12px 40px rgba(0,0,0,.15);}
.note-card h3{font-size:13px;font-weight:600;color:#3a3530;margin-bottom:10px;}
#note-input{width:100%;height:60px;padding:8px;border:1px solid #e0dbd5;border-radius:8px;font-size:11px;font-family:'DM Sans',sans-serif;color:#3a3530;resize:none;}
#note-input:focus{outline:none;border-color:#4a7c6f;}
.note-actions{display:flex;gap:8px;margin-top:10px;justify-content:flex-end;}
.note-skip{background:none;border:1px solid #e0dbd5;padding:6px 14px;border-radius:8px;font-size:11px;color:#6b6158;cursor:pointer;transition:background .15s;}
.note-skip:hover{background:#f0ede8;}
.note-save{background:#4a7c6f;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:500;color:#fff;cursor:pointer;transition:background .15s;}
.note-save:hover{background:#3d6b5f;}

/* TOAST */
#toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);background:#3a3530;color:#fff;padding:8px 18px;border-radius:10px;font-size:12px;font-weight:500;opacity:0;transition:opacity .3s,transform .3s;z-index:100001;pointer-events:none;}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0);}

/* SCROLLBAR */
#body::-webkit-scrollbar{width:4px;}
#body::-webkit-scrollbar-track{background:transparent;}
#body::-webkit-scrollbar-thumb{background:#d9d4cd;border-radius:2px;}
#settings-panel::-webkit-scrollbar{width:4px;}
#settings-panel::-webkit-scrollbar-track{background:transparent;}
#settings-panel::-webkit-scrollbar-thumb{background:#d9d4cd;border-radius:2px;}
`;
shadowRoot.appendChild(style);

const container = document.createElement('div');
container.innerHTML = `<div id="tracker">

  <!-- HEADER -->
  <div id="header">
    <div class="header-icon">⏱</div>
    <div style="flex:1;min-width:0;">
      <div class="header-title">Time Tracker</div>
      <div class="header-subtitle" id="header-date">Work Session</div>
    </div>
    <div class="header-btns">
      <button class="hbtn" id="focus-btn"    title="Focus mode">🎯</button>
      <button class="hbtn" id="settings-btn" title="Settings">⚙</button>
      <button class="hbtn" id="clear-btn"    title="Clear today's log">🗑</button>
      <button class="hbtn" id="collapse-btn" title="Collapse">−</button>
    </div>
  </div>

  <!-- FOCUS PILL -->
  <div id="focus-pill">
    <div id="focus-task-name">Idle</div>
    <div id="focus-timer">00:00:00</div>
  </div>

  <!-- SETTINGS PANEL -->
  <div id="settings-panel">

    <div class="sett-section">
      <div class="sett-label"><span>📋</span> Tasks &amp; Goals <span style="font-weight:400;font-size:9px;color:#b0a89e;">(set goal hrs)</span></div>
      <div id="task-list-edit"></div>
      <div class="add-task-row">
        <input class="add-task-input" id="new-task-input" placeholder="Add new task…" maxlength="50"/>
        <button class="add-task-btn" id="add-task-btn">+ Add</button>
      </div>
    </div>

    <div class="sett-section">
      <div class="sett-label"><span>🔔</span> Overrun Alert</div>
      <div class="notif-row">
        <label for="notif-toggle">Notify when task runs too long</label>
        <label class="toggle-switch">
          <input type="checkbox" id="notif-toggle"/>
          <div class="toggle-track"></div>
        </label>
      </div>
      <div class="idle-mins-wrap">
        <span class="idle-mins-label">Alert after (minutes)</span>
        <input type="number" class="idle-mins-input" id="notif-mins" value="90" min="5" max="480"/>
      </div>
    </div>

    <div class="sett-section">
      <div class="sett-label"><span>💤</span> Idle Detection</div>
      <div class="notif-row">
        <label for="idle-toggle">Auto-pause on idle</label>
        <label class="toggle-switch">
          <input type="checkbox" id="idle-toggle"/>
          <div class="toggle-track"></div>
        </label>
      </div>
      <div class="idle-mins-wrap">
        <span class="idle-mins-label">Idle timeout (minutes)</span>
        <input type="number" class="idle-mins-input" id="idle-mins" value="5" min="1" max="60"/>
      </div>
    </div>

    <div class="sett-section">
      <div class="sett-label"><span>📊</span> Google Sheets Push</div>
      <div class="sheets-input-wrap">
        <input class="sheets-url-input" id="sheets-url" placeholder="Paste Apps Script Web App URL…"/>
      </div>
      <div class="sheets-status" id="sheets-status">Not configured</div>
      <a class="script-help" id="script-help-toggle">How to set up Google Sheets push ▸</a>
      <div class="script-code-box" id="script-code-box">// 1. Open Google Sheets → Extensions → Apps Script
// 2. Paste this code:

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('TimeLog') || ss.insertSheet('TimeLog');
  var data = JSON.parse(e.postData.contents);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Task','Start','End','Duration','Note','Date']);
  }
  data.entries.forEach(function(r) {
    sheet.appendRow([r.task, r.start, r.end, r.duration, r.note||'', r.date||'']);
  });
  return ContentService.createTextOutput('OK');
}

// 3. Deploy → New Deployment → Web App
//    Execute as: Me | Access: Anyone
// 4. Copy the URL and paste it above</div>
    </div>

  </div><!-- /settings -->

  <!-- TAB BAR -->
  <div id="tab-bar">
    <button class="tab-btn active" data-tab="track">Track</button>
    <button class="tab-btn" data-tab="summary">Summary</button>
    <button class="tab-btn" data-tab="history">History</button>
  </div>

  <!-- BODY -->
  <div id="body">

    <!-- ───── TRACK TAB ───── -->
    <div class="tab-panel active" id="tab-track">
      <div class="active-area">
        <div id="active-task">No active task</div>
        <div id="timer-display">00:00:00</div>
        <div class="pulse-dot">
          <span id="pulse"></span>
          <span id="pulse-text">Idle</span>
        </div>
        <div id="start-time-label"></div>
        <button id="stop-btn" disabled>⏹ Stop</button>
      </div>

      <button id="resume-btn">▶ Resume: <span id="resume-task-name"></span></button>

      <div class="select-wrap">
        <div class="select-label">Switch Task</div>
        <select id="task-select"><option value="">— Choose a task —</option></select>
        <span class="select-arrow">▾</span>
      </div>

      <div id="total-row">
        <span class="total-label">⏱ Total today</span>
        <span id="total-display">00:00:00</span>
      </div>

      <div class="export-row">
        <button class="exp-btn" id="csv-btn"><span class="btn-icon">📥</span> CSV</button>
        <button class="exp-btn sheets" id="sheets-btn"><span class="btn-icon">📊</span> Push to Sheets</button>
      </div>

    </div><!-- /track -->

    <!-- ───── SUMMARY TAB ───── -->
    <div class="tab-panel" id="tab-summary">
      <div style="padding-top:14px;">
        <div class="summary-date-row">
          <button class="date-nav-btn" id="sum-prev">‹</button>
          <span class="summary-date-label" id="sum-date-label">Today</span>
          <button class="date-nav-btn" id="sum-next">›</button>
        </div>
        <div class="summary-total-row">
          <span class="summary-total-lbl">⏱ Total tracked</span>
          <span class="summary-total-val" id="sum-total">00:00:00</span>
        </div>
        <div class="chart-wrap" id="sum-chart"></div>
      </div>
    </div><!-- /summary -->

    <!-- ───── HISTORY TAB ───── -->
    <div class="tab-panel" id="tab-history">
      <div style="padding-top:14px;">
        <!-- Today's log lives here now -->
        <div class="history-section-title">📋 Today's Log <span class="badge" id="log-count">0 entries</span></div>
        <div id="today-log-wrap">
          <table class="log-table" id="log-table">
            <thead><tr><th>Task</th><th>Start</th><th>Duration</th><th>Note</th></tr></thead>
            <tbody id="log-body">
              <tr id="empty-row"><td colspan="4"><div class="empty-log"><div class="empty-icon">📋</div>No entries yet</div></td></tr>
            </tbody>
          </table>
        </div>

        <div class="divider" style="margin:14px 0;"></div>

        <div class="history-section-title">📅 Past Days</div>
        <div id="history-panel"></div>
      </div>
    </div><!-- /history -->

  </div><!-- /body -->
</div><!-- /tracker -->`;
shadowRoot.appendChild(container);

// Storage adapters (getStorage/setStorage) are imported from
// ../../core/store.js — shared with the service worker.

(async function() {
  
// ─── DEFAULTS ────────────────────────────────────────────────────────────────
// DEFAULT_TASKS, TASK_COLORS, and SK are imported from ../../shared/constants.js

const state = {
  tasks:[], currentTask:null, startTime:null, elapsed:0,
  timerInterval:null, totalSeconds:0, log:[],
  history:{},
  idleEnabled:false, idleMins:5, idleWarnTimer:null, idlePauseTimer:null,
  notifEnabled:false, notifMins:90, notifTimer:null,
  sheetsUrl:'', lastTask:null, summaryOffset:0,
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
// pad, fmt, fmtTime, todayStr, dateLabel are imported from ../../core/time.js

function showToast(msg,dur){
  const t=shadowRoot.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._tid);
  t._tid=setTimeout(()=>t.classList.remove('show'),dur||2500);
}

// ─── SAVE / LOAD ─────────────────────────────────────────────────────────────
async function save(){
  try{
    await setStorage(SK.tasks, JSON.stringify(state.tasks));
    await setStorage(SK.log, JSON.stringify(state.log));
    await setStorage(SK.total, String(state.totalSeconds));
    await setStorage(SK.logDate, todayStr());
    await setStorage(SK.history, JSON.stringify(state.history));
    await setStorage(SK.idleOn, String(state.idleEnabled));
    await setStorage(SK.idleMins, String(state.idleMins));
    await setStorage(SK.notifOn, String(state.notifEnabled));
    await setStorage(SK.notifMins, String(state.notifMins));
    await setStorage(SK.sheetsUrl, state.sheetsUrl);
  }catch(e){}
}


async function load(){
  try{
    // Auto-migration from window.localStorage to chrome.storage.local
    if (window.localStorage.getItem(SK.tasks) && !(await getStorage('migrated_tt3'))) {
      const keys = [SK.tasks, SK.log, SK.total, SK.logDate, SK.history, SK.idleOn, SK.idleMins, SK.notifOn, SK.notifMins, SK.sheetsUrl];
      for (let k of keys) {
        let v = window.localStorage.getItem(k);
        if (v !== null) await setStorage(k, v);
      }
      await setStorage('migrated_tt3', 'true');
      console.log('Migrated tt3 data from localStorage to chrome.storage.local');
    }

    
    const raw=await getStorage(SK.tasks);
    
    // Robust parsing to fix corrupted data showing "null"
    try {
      state.tasks = (raw && raw !== "null") ? JSON.parse(raw) : null;
    } catch(e) {
      state.tasks = null;
    }
    
    // Hard fallback if corrupted
    if (!state.tasks || !Array.isArray(state.tasks) || state.tasks.length === 0) {
      state.tasks = DEFAULT_TASKS.map(t=>({...t}));
      console.log('Fell back to DEFAULT_TASKS to fix corruption.');
    }

    const savedDate=await getStorage(SK.logDate);
    if(savedDate===todayStr()){
      const rl=await getStorage(SK.log);
      state.log=rl?JSON.parse(rl).map(e=>({...e,start:new Date(e.start),end:new Date(e.end)})):[];
      state.totalSeconds=parseInt(await getStorage(SK.total)||'0',10);
    }else{
      // Archive yesterday's log if exists
      if(savedDate && await getStorage(SK.log)){
        const oldLog=JSON.parse(await getStorage(SK.log)).map(e=>({...e,start:new Date(e.start),end:new Date(e.end)}));
        if(oldLog.length>0){
          const rh=await getStorage(SK.history);
          const hist=rh?JSON.parse(rh):{};
          hist[savedDate]=oldLog;
          state.history=hist;
          Object.keys(state.history).forEach(k=>{state.history[k]=state.history[k].map(e=>({...e,start:new Date(e.start),end:new Date(e.end)}));});
          await setStorage(SK.history, JSON.stringify(state.history));
        }
      }
      state.log=[]; state.totalSeconds=0;
    }
    const rh=await getStorage(SK.history);
    if(rh){
      const raw2=JSON.parse(rh);
      Object.keys(raw2).forEach(k=>{raw2[k]=raw2[k].map(e=>({...e,start:new Date(e.start),end:new Date(e.end)}));});
      state.history=raw2;
    }
    state.idleEnabled  = await getStorage(SK.idleOn)==='true';
    state.idleMins     = parseInt(await getStorage(SK.idleMins)||'5',10);
    state.notifEnabled = await getStorage(SK.notifOn)==='true';
    state.notifMins    = parseInt(await getStorage(SK.notifMins)||'90',10);
    state.sheetsUrl    = await getStorage(SK.sheetsUrl)||'';
  }catch(e){ state.tasks=DEFAULT_TASKS.map(t=>({...t})); }
}

// ─── ELEMENTS ─────────────────────────────────────────────────────────────────
function $id(id){ return shadowRoot.getElementById(id); }
const el={
  tracker:$id('tracker'), header:$id('header'), headerDate:$id('header-date'),
  focusBtn:$id('focus-btn'), focusPill:$id('focus-pill'),
  focusTaskName:$id('focus-task-name'), focusTimer:$id('focus-timer'),
  settingsBtn:$id('settings-btn'), settingsPanel:$id('settings-panel'),
  collapseBtn:$id('collapse-btn'), clearBtn:$id('clear-btn'),
  activeTask:$id('active-task'), timerDisplay:$id('timer-display'),
  pulse:$id('pulse'), pulseText:$id('pulse-text'), startLabel:$id('start-time-label'),
  stopBtn:$id('stop-btn'), resumeBtn:$id('resume-btn'), resumeName:$id('resume-task-name'),
  taskSelect:$id('task-select'), totalDisplay:$id('total-display'),
  logBody:$id('log-body'), logCount:$id('log-count'),
  csvBtn:$id('csv-btn'), sheetsBtn:$id('sheets-btn'),
  noteModal:$id('note-modal'), noteInput:$id('note-input'),
  noteSkip:$id('note-skip'), noteSave:$id('note-save'),
  taskListEdit:$id('task-list-edit'), newTaskInput:$id('new-task-input'), addTaskBtn:$id('add-task-btn'),
  idleToggle:$id('idle-toggle'), idleMinsInput:$id('idle-mins'),
  notifToggle:$id('notif-toggle'), notifMinsInput:$id('notif-mins'),
  sheetsUrlInput:$id('sheets-url'), sheetsStatus:$id('sheets-status'),
  scriptHelpToggle:$id('script-help-toggle'), scriptCodeBox:$id('script-code-box'),
  historyPanel:$id('history-panel'),
  sumPrev:$id('sum-prev'), sumNext:$id('sum-next'),
  sumDateLabel:$id('sum-date-label'), sumTotal:$id('sum-total'), sumChart:$id('sum-chart'),
};

// ─── RENDER HELPERS ──────────────────────────────────────────────────────────
function rebuildSelect(){
  el.taskSelect.innerHTML='<option value="">— Choose a task —</option>';
  state.tasks.forEach(t=>{
    const o=document.createElement('option'); o.value=t.name; o.textContent=t.name;
    el.taskSelect.appendChild(o);
  });
}

function rebuildLogTable(){
  el.logBody.innerHTML='';
  if(state.log.length===0){
    el.logBody.innerHTML='<tr><td colspan="4"><div class="empty-log"><div class="empty-icon">📋</div>No entries yet</div></td></tr>';
    el.logCount.textContent='0 entries';
    el.totalDisplay.textContent='00:00:00';
    return;
  }
  [...state.log].reverse().forEach(e=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="task-name" title="${e.task}">${e.task}</td><td class="time-col">${fmtTime(e.start)}</td><td class="dur">${e.duration}</td><td class="note-cell" title="${e.note||''}">${e.note||'—'}</td>`;
    el.logBody.appendChild(tr);
  });
  el.logCount.textContent=`${state.log.length} entr${state.log.length===1?'y':'ies'}`;
  el.totalDisplay.textContent=fmt(state.totalSeconds);
}

function rebuildTaskListEdit(){
  el.taskListEdit.innerHTML='';
  state.tasks.forEach((t,i)=>{
    const row=document.createElement('div'); row.className='task-edit-row';
    row.innerHTML=`<input class="task-edit-name" value="${t.name}" data-i="${i}"/><input class="task-edit-goal" type="number" min="0" max="24" step="0.5" value="${t.goal||0}" data-gi="${i}" title="Goal (hours)"/><button class="task-edit-del" data-di="${i}" title="Remove">✕</button>`;
    el.taskListEdit.appendChild(row);
  });
  el.taskListEdit.querySelectorAll('.task-edit-name').forEach(inp=>{
    inp.addEventListener('change',async ()=>{state.tasks[inp.dataset.i].name=inp.value;await save();rebuildSelect();});
  });
  el.taskListEdit.querySelectorAll('.task-edit-goal').forEach(inp=>{
    inp.addEventListener('change',async ()=>{state.tasks[parseInt(inp.dataset.gi)].goal=parseFloat(inp.value)||0;await save();});
  });
  el.taskListEdit.querySelectorAll('.task-edit-del').forEach(btn=>{
    btn.addEventListener('click',async ()=>{
      if(state.tasks.length<=1){showToast('Need at least one task');return;}
      state.tasks.splice(parseInt(btn.dataset.di),1); await save(); rebuildSelect(); rebuildTaskListEdit();
    });
  });
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
// The service worker owns the running timer (Phase 3). This widget only:
//   • reflects the active timer in the UI (applyActive),
//   • derives the ticking elapsed display from startTime (tickDisplay),
//   • sends START/STOP commands to the worker (startTimer / stopTimer).
// Every open tab calls applyActive from chrome.storage.onChanged, so they all
// agree on what is running and for how long.

// Render the UI for a given active timer ({ task, startTime } | null).
// Display only — does not arm idle/overrun (the issuing tab does that).
function applyActive(activeTimer){
  clearInterval(state.timerInterval);
  if(activeTimer){
    state.currentTask=activeTimer.task;
    state.startTime=new Date(activeTimer.startTime);
    el.activeTask.textContent=activeTimer.task;
    el.pulse.classList.add('on');
    el.pulseText.textContent='Tracking';
    el.startLabel.textContent='Started '+fmtTime(state.startTime);
    el.stopBtn.disabled=false;
    el.resumeBtn.style.display='none';
    el.focusTaskName.textContent=cleanLabel(activeTimer.task);
    el.taskSelect.value=activeTimer.task;
    tickDisplay();
    state.timerInterval=setInterval(tickDisplay,1000);
  }else{
    state.currentTask=null;
    state.startTime=null;
    state.elapsed=0;
    el.activeTask.textContent='No active task';
    el.timerDisplay.textContent='00:00:00';
    el.pulse.classList.remove('on');
    el.pulseText.textContent='Idle';
    el.startLabel.textContent='';
    el.stopBtn.disabled=true;
    el.focusTaskName.textContent='Idle';
    el.focusTimer.textContent='00:00:00';
  }
}

// Recompute elapsed from the worker-owned startTime (not a local counter).
function tickDisplay(){
  if(!state.startTime) return;
  state.elapsed=Math.max(0,Math.floor((Date.now()-state.startTime.getTime())/1000));
  const display=fmt(state.elapsed);
  el.timerDisplay.textContent=display;
  el.focusTimer.textContent=display;
}

// Command the worker to start a task; arm idle/overrun in this (issuing) tab.
async function startTimer(taskName){
  const res=await chrome.runtime.sendMessage({type:MSG.START_TIMER,task:taskName});
  applyActive(res&&res.activeTimer?res.activeTimer:{task:taskName,startTime:Date.now()});
  startOverrunTimer();
  resetIdleTimers();
}

// Command the worker to stop; return a log entry for the finished block (or null).
async function stopTimer(){
  const res=await chrome.runtime.sendMessage({type:MSG.STOP_TIMER});
  clearTimeout(state.notifTimer);
  clearTimeout(state.idleWarnTimer);
  clearTimeout(state.idlePauseTimer);
  applyActive(null);
  if(!res||!res.stopped) return null;
  const {task,startTime,endTime}=res.stopped;
  state.lastTask=task;
  const elapsedSec=Math.max(0,Math.round((endTime-startTime)/1000));
  return makeEntry({task,start:new Date(startTime),end:new Date(endTime),elapsedSec});
}

async function addLogRow(entry){
  state.log.push(entry);
  state.totalSeconds+=entry.durationSec;
  // Also add to today's history
  if(!state.history[todayStr()]) state.history[todayStr()]=[];
  state.history[todayStr()].push(entry);
  rebuildLogTable();
  await save();
  // Show resume safely
  if (el.resumeName) el.resumeName.textContent = (state.lastTask || "");
  if (el.resumeBtn) el.resumeBtn.style.display = 'block';
}


// ─── NOTE MODAL ──────────────────────────────────────────────────────────────
let pendingEntry=null, pendingCb=null;
function openNoteModal(entry,cb){
  pendingEntry=entry; pendingCb=cb;
  el.noteInput.value='';
  el.noteModal.classList.add('open');
  el.noteInput.focus();
}
el.noteSkip.addEventListener('click',()=>{
  el.noteModal.classList.remove('open');
  if(pendingEntry&&pendingCb){pendingCb();pendingEntry=null;pendingCb=null;}
});
el.noteSave.addEventListener('click',()=>{
  if(pendingEntry) pendingEntry.note=el.noteInput.value.trim();
  el.noteModal.classList.remove('open');
  if(pendingEntry&&pendingCb){pendingCb();pendingEntry=null;pendingCb=null;}
});

// ─── OVERRUN ALERT ───────────────────────────────────────────────────────────
function startOverrunTimer(){
  clearTimeout(state.notifTimer);
  if(!state.notifEnabled||!state.currentTask) return;
  const ms=state.notifMins*60*1000;
  state.notifTimer=setTimeout(function fire(){
    showToast(`🔔 "${state.currentTask}" running over ${state.notifMins} min!`,5000);
    if(Notification.permission==='granted'){
      new Notification('⏱ Task Overrun',{body:`"${state.currentTask}" has been running for ${state.notifMins}+ minutes.`});
    }
    state.notifTimer=setTimeout(fire,ms);
  },ms);
}

// ─── IDLE DETECTION ──────────────────────────────────────────────────────────
let lastActivity=Date.now();
function resetIdleTimers(){
  lastActivity=Date.now();
  clearTimeout(state.idleWarnTimer);
  clearTimeout(state.idlePauseTimer);
  if(!state.idleEnabled||!state.currentTask) return;
  const ms=state.idleMins*60*1000;
  state.idleWarnTimer=setTimeout(()=>{
    showToast('💤 Idle detected — stopping in 30s…',4000);
    state.idlePauseTimer=setTimeout(async ()=>{
      if(state.currentTask){
        const e=await stopTimer();
        if(e){e.note='(auto-stopped: idle)';await addLogRow(e);el.taskSelect.value='';}
        showToast('⏸ Auto-stopped — you seemed idle',3000);
      }
    },30000);
  },ms);
}
['mousemove','keydown','mousedown','touchstart','scroll'].forEach(evt=>{
  document.addEventListener(evt,()=>{
    if(state.currentTask&&state.idleEnabled){resetIdleTimers();}
  },{passive:true});
});

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
function buildSummary(){
  const d=new Date(); d.setDate(d.getDate()-state.summaryOffset);
  const ds=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  el.sumDateLabel.textContent=state.summaryOffset===0?'Today':dateLabel(ds);
  const entries=state.summaryOffset===0?state.log:(state.history[ds]||[]);
  if(entries.length===0){
    el.sumTotal.textContent='00:00:00';
    el.sumChart.innerHTML='<div class="summary-empty">No data for this day</div>';
    return;
  }
  // Aggregate by task (core/summary.js)
  const {total,max,sorted}=aggregateByTask(entries);
  el.sumTotal.textContent=fmt(total);
  const goals=goalMap(state.tasks);
  el.sumChart.innerHTML='';
  sorted.forEach(([task,sec],i)=>{
    const pct=barPct(sec,max);
    const progress=goalProgress(sec,goals[task]||0);
    let goalBadge='';
    if(progress){
      goalBadge=progress.done?'<span class="chart-bar-goal" style="background:rgba(74,124,111,.7)">✓ Done</span>':`<span class="chart-bar-goal">${progress.pct}%</span>`;
    }
    const color=TASK_COLORS[i%TASK_COLORS.length];
    const row=document.createElement('div'); row.className='chart-bar-row';
    row.innerHTML=`<div class="chart-label" title="${task}">${cleanLabel(task)}</div><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%;background:${color}">${goalBadge}</div></div><div class="chart-bar-time">${fmt(sec)}</div>`;
    el.sumChart.appendChild(row);
  });
}
el.sumPrev.addEventListener('click',()=>{state.summaryOffset++;buildSummary();});
el.sumNext.addEventListener('click',()=>{if(state.summaryOffset>0){state.summaryOffset--;buildSummary();}});

// ─── HISTORY ─────────────────────────────────────────────────────────────────
function buildHistory(){
  // Rebuild today's log table
  rebuildLogTable();
  // Past days
  el.historyPanel.innerHTML='';
  const days=Object.keys(state.history).filter(k=>k!==todayStr()).sort().reverse();
  if(days.length===0){
    el.historyPanel.innerHTML='<div class="history-empty">No past logs yet</div>';
    return;
  }
  days.forEach(ds=>{
    const entries=state.history[ds]||[];
    const totalSec=entries.reduce((a,e)=>a+(e.durationSec||0),0);
    const wrap=document.createElement('div'); wrap.className='hist-day';
    const hdr=document.createElement('div'); hdr.className='hist-day-header';
    hdr.innerHTML=`<span class="hist-day-date">${dateLabel(ds)}</span><span class="hist-day-total">${fmt(totalSec)}</span>`;
    const list=document.createElement('div'); list.className='hist-day-entries';
    entries.forEach(e=>{
      const row=document.createElement('div'); row.className='hist-entry';
      row.innerHTML=`<span class="hist-entry-task" title="${e.task}">${e.task}</span><span class="hist-entry-note" title="${e.note||''}">${e.note?'📝':''}</span><span class="hist-entry-time">${fmtTime(e.start)}</span><span class="hist-entry-dur">${e.duration}</span>`;
      list.appendChild(row);
    });
    hdr.addEventListener('click',()=>list.classList.toggle('open'));
    wrap.appendChild(hdr); wrap.appendChild(list);
    el.historyPanel.appendChild(wrap);
  });
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
shadowRoot.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click',async ()=>{
    shadowRoot.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    shadowRoot.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const tab=btn.dataset.tab;
    shadowRoot.getElementById('tab-'+tab).classList.add('active');
    if(tab==='summary'){ state.summaryOffset=0; buildSummary(); }
    if(tab==='history') buildHistory();
  });
});

// ─── EVENTS ───────────────────────────────────────────────────────────────────
el.taskSelect.addEventListener('change',async ()=>{
  const v=el.taskSelect.value; if(!v) return;
  if(state.currentTask){
    const e=await stopTimer();
    if(e){ openNoteModal(e,async ()=>{ await addLogRow(e); await startTimer(v); }); return; }
  }
  await startTimer(v);
});

el.stopBtn.addEventListener('click',async ()=>{
  const e=await stopTimer(); if(e){ el.taskSelect.value=''; openNoteModal(e,()=>addLogRow(e)); }
});

el.resumeBtn.addEventListener('click',async ()=>{
  if(!state.lastTask) return;
  el.taskSelect.value=state.lastTask;
  await startTimer(state.lastTask); el.resumeBtn.style.display='none';
});

el.clearBtn.addEventListener('click',async ()=>{
  if(!confirm('Clear today\'s log?')) return;
  if(state.currentTask){ await stopTimer(); el.taskSelect.value=''; }
  state.log=[]; state.totalSeconds=0;
  delete state.history[todayStr()];
  rebuildLogTable(); await save(); showToast('🗑 Log cleared');
});

el.collapseBtn.addEventListener('click',()=>{
  const c=el.tracker.classList.toggle('collapsed');
  el.collapseBtn.textContent=c?'+':'−'; el.collapseBtn.title=c?'Expand':'Collapse';
  if(c) el.settingsPanel.classList.remove('open');
});

// FOCUS MODE
el.focusBtn.addEventListener('click',()=>{
  const f=el.tracker.classList.toggle('focus-mode');
  el.focusBtn.title=f?'Exit focus':'Focus mode';
  el.focusBtn.classList.toggle('active-btn',f);
  if(f) el.tracker.classList.remove('collapsed');
});

el.settingsBtn.addEventListener('click',()=>{
  const o=el.settingsPanel.classList.toggle('open');
  el.settingsBtn.classList.toggle('active-btn',o);
  if(o){ rebuildTaskListEdit(); el.tracker.classList.remove('collapsed'); el.tracker.classList.remove('focus-mode'); }
});

el.scriptHelpToggle.addEventListener('click',e=>{
  e.preventDefault(); const b=el.scriptCodeBox;
  b.style.display=b.style.display==='none'?'block':'none';
});

// Settings save handlers
el.addTaskBtn.addEventListener('click',async ()=>{
  const v=el.newTaskInput.value.trim(); if(!v) return;
  state.tasks.push({name:v,goal:0}); el.newTaskInput.value='';
  await save(); rebuildSelect(); rebuildTaskListEdit(); showToast('✅ Task added');
});
el.newTaskInput.addEventListener('keydown',e=>{if(e.key==='Enter') el.addTaskBtn.click();});

el.idleToggle.addEventListener('change',async ()=>{state.idleEnabled=el.idleToggle.checked;await save();});
el.idleMinsInput.addEventListener('change',async ()=>{state.idleMins=parseInt(el.idleMinsInput.value)||5;await save();});
el.notifToggle.addEventListener('change',async ()=>{
  state.notifEnabled=el.notifToggle.checked; await save();
  if(state.notifEnabled&&Notification.permission==='default') Notification.requestPermission();
  if(state.currentTask) startOverrunTimer();
});
el.notifMinsInput.addEventListener('change',async ()=>{state.notifMins=parseInt(el.notifMinsInput.value)||90;await save();if(state.currentTask) startOverrunTimer();});
el.sheetsUrlInput.addEventListener('change',async ()=>{
  state.sheetsUrl=el.sheetsUrlInput.value.trim(); await save();
  if(state.sheetsUrl){el.sheetsStatus.textContent='✅ URL configured';el.sheetsStatus.className='sheets-status ok';}
  else{el.sheetsStatus.textContent='Not configured';el.sheetsStatus.className='sheets-status';}
});

// ─── EXPORT ───────────────────────────────────────────────────────────────────
el.csvBtn.addEventListener('click',()=>{
  if(state.log.length===0){ showToast('No entries to export'); return; }
  const csv=buildCsv(state.log);
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`timesheet-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  showToast('📥 CSV downloaded');
});

el.sheetsBtn.addEventListener('click',async ()=>{
  if(state.log.length===0){ showToast('No entries to push'); return; }
  if(state.sheetsUrl){
    // Direct push via Apps Script
    el.sheetsBtn.innerHTML='<span class="btn-icon">📊</span> Pushing…'; el.sheetsBtn.disabled=true;
    try{
      const payload=buildSheetsPayload(state.log);
      const res=await fetch(state.sheetsUrl,{method:'POST',body:JSON.stringify(payload),headers:{'Content-Type':'text/plain'}});
      const txt=await res.text();
      if(txt==='OK') showToast('📊 Pushed to Google Sheets!',3500); else throw new Error(txt);
    }catch(err){ showToast('❌ Push failed — check Apps Script URL',4000); console.error(err); }
    finally{ el.sheetsBtn.innerHTML='<span class="btn-icon">📊</span> Push to Sheets'; el.sheetsBtn.disabled=false; }
  }else{
    // Clipboard fallback
    const tsv=buildTsv(state.log);
    navigator.clipboard.writeText(tsv).then(()=>{
      showToast('📊 Data copied — paste into Google Sheets',3500);
      window.open('https://sheets.new','_blank');
    }).catch(()=>{ window.open('https://sheets.new','_blank'); });
  }
});

// ─── DRAG ─────────────────────────────────────────────────────────────────────
(async function() { let ox=0,oy=0,sx=0,sy=0;
  el.header.addEventListener('mousedown',async (e)=>{
    if(e.target.tagName==='BUTTON') return;
    const r=el.tracker.getBoundingClientRect();
    el.tracker.style.bottom='auto'; el.tracker.style.right='auto';
    el.tracker.style.top=r.top+'px'; el.tracker.style.left=r.left+'px';
    sx=e.clientX; sy=e.clientY; ox=r.left; oy=r.top;
    el.tracker.classList.add('dragging');
    const mv=e=>{el.tracker.style.left=Math.max(0,Math.min(ox+(e.clientX-sx),window.innerWidth-el.tracker.offsetWidth))+'px';el.tracker.style.top=Math.max(0,Math.min(oy+(e.clientY-sy),window.innerHeight-40))+'px';};
    const up=async ()=>{el.tracker.classList.remove('dragging');try{await setStorage(SK.position, JSON.stringify({left:el.tracker.style.left,top:el.tracker.style.top}));}catch(e){}document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  });
})();

// ─── CROSS-TAB SYNC ─────────────────────────────────────────────────────────
// The worker writes the active timer to storage; every tab reflects it here, so
// two open widgets never disagree about what is running.
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local') return;
  if(SK.activeTimer in changes){
    applyActive(changes[SK.activeTimer].newValue||null);
  }
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
(async function() { await load();
  try{const p=JSON.parse(await getStorage(SK.position)||'null');if(p?.left&&p?.top){el.tracker.style.bottom='auto';el.tracker.style.right='auto';el.tracker.style.left=p.left;el.tracker.style.top=p.top;}}catch(e){}
  el.headerDate.textContent=todayStr();
  rebuildSelect(); rebuildLogTable();
  el.idleToggle.checked=state.idleEnabled; el.idleMinsInput.value=state.idleMins;
  el.notifToggle.checked=state.notifEnabled; el.notifMinsInput.value=state.notifMins;
  el.sheetsUrlInput.value=state.sheetsUrl;
  if(state.sheetsUrl){el.sheetsStatus.textContent='✅ URL configured';el.sheetsStatus.className='sheets-status ok';}
  if(state.notifEnabled&&Notification.permission==='default') Notification.requestPermission();
  // Reflect any timer already running in the worker (survives tab reloads).
  try{const st=await chrome.runtime.sendMessage({type:MSG.GET_STATE});applyActive(st&&st.activeTimer?st.activeTimer:null);}catch(e){}
})();

})();
