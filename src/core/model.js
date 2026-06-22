// Task / Entry factories and small model helpers.
// Mirrors the shapes used in content.js (Phase 1 — no behavior change).

import { fmt, todayStr } from './time.js';

// Build a task object. Tasks are { name, goal } where goal is in hours.
export const makeTask = (name, goal = 0) => ({ name, goal });

// Strip the leading emoji/symbol prefix from a task name for compact display.
// "📅  Daily Meetings" -> "Daily Meetings". Matches the inline
// `task.replace(/^\S+\s+/,'')` used throughout content.js.
export const cleanLabel = (name) => name.replace(/^\S+\s+/, '');

// Build a completed log entry from a tracked block.
// `elapsedSec` is the tracked duration; `start`/`end` are Date instances.
export const makeEntry = ({ task, start, end = new Date(), elapsedSec, note = '', date }) => ({
  task,
  start,
  end,
  duration: fmt(elapsedSec),
  durationSec: elapsedSec,
  note,
  date: date ?? todayStr(),
});

// Revive an entry's date fields from storage (JSON stores dates as strings).
export const reviveEntry = (e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) });
