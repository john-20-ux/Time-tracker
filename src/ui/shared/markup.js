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

  <!-- Settings live on the dedicated options page (the gear opens it). -->

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
