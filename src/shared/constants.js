// Shared constants for Time Tracker Pro.
// Extracted verbatim from content.js (Phase 1 — no behavior change).

// Default task list seeded on first run / when stored tasks are corrupt.
export const DEFAULT_TASKS = [
  { name: '📅  Daily Meetings',       goal: 0 },
  { name: '🎫  Tickets Overview',     goal: 0 },
  { name: '🔧  Technical Feasibility', goal: 0 },
  { name: '📋  Planning and Spec',    goal: 0 },
  { name: '🔬  Research',             goal: 0 },
  { name: '📝  Documentation',        goal: 0 },
  { name: '📞  Customer Call',        goal: 0 },
  { name: '🍵  Tea Break',            goal: 0 },
  { name: '🍽  Lunch',                goal: 0 },
  { name: '📂  Others',               goal: 0 },
];

// Bar-chart colors, indexed by task position in the summary.
export const TASK_COLORS = [
  '#4a7c6f', '#6b9e94', '#8cb5af', '#5c8c80', '#7aaa9e',
  '#a0c4be', '#3d6b5f', '#5a8a7f', '#709e94', '#4a7c6f',
];

// chrome.storage.local keys (the legacy `tt3_` scheme).
export const SK = {
  tasks: 'tt3_tasks',
  log: 'tt3_log',
  total: 'tt3_total',
  logDate: 'tt3_logDate',
  history: 'tt3_history',
  position: 'tt3_position',
  idleOn: 'tt3_idleOn',
  idleMins: 'tt3_idleMins',
  notifOn: 'tt3_notifOn',
  notifMins: 'tt3_notifMins',
  sheetsUrl: 'tt3_sheetsUrl',
  // The running timer, owned by the service worker (Phase 3).
  // Shape: { task: string, startTime: number(epoch ms) } | absent
  activeTimer: 'tt3_activeTimer',
  // Whether the floating widget content script is registered (Phase 7).
  widgetEnabled: 'tt3_widgetEnabled',
};

// id used for the dynamically-registered floating-widget content script.
export const WIDGET_SCRIPT_ID = 'tt-widget';
