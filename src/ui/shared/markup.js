// Shared tracker markup, injected into a Shadow DOM (widget) or the popup
// document. Behavior is wired by mountTrackerUI in controller.js. Static markup
// only — no user data is interpolated here.

export const TRACKER_HTML = `<div id="tracker">

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
</div><!-- /tracker -->

<!-- NOTE MODAL -->
<div id="note-modal">
  <div class="note-card">
    <h3>Add a note</h3>
    <textarea id="note-input" placeholder="What did you work on? (optional)"></textarea>
    <div class="note-actions">
      <button class="note-skip" id="note-skip">Skip</button>
      <button class="note-save" id="note-save">Save</button>
    </div>
  </div>
</div>

<!-- TOAST -->
<div id="toast"></div>`;
