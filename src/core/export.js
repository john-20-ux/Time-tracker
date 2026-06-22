// Export builders — pure string/payload construction extracted from the
// CSV / Sheets handlers in content.js (Phase 1 — no behavior change).

import { todayStr } from './time.js';

// Build CSV text from a log of entries. Task and Note are quoted, matching
// the original csvBtn handler exactly.
export function buildCsv(log) {
  const rows = [['Task', 'Start', 'End', 'Duration', 'Note']];
  log.forEach((e) =>
    rows.push([
      `"${e.task}"`,
      e.start.toLocaleString(),
      e.end.toLocaleString(),
      e.duration,
      `"${e.note || ''}"`,
    ]),
  );
  return rows.map((r) => r.join(',')).join('\n');
}

// Build TSV text for the clipboard fallback (paste-into-Sheets path).
export function buildTsv(log) {
  const rows = [
    ['Task', 'Start', 'End', 'Duration (HH:MM:SS)', 'Note'],
    ...log.map((e) => [
      e.task,
      e.start.toLocaleString(),
      e.end.toLocaleString(),
      e.duration,
      e.note || '',
    ]),
  ];
  return rows.map((r) => r.join('\t')).join('\n');
}

// Build the JSON payload POSTed to the Apps Script Web App.
export function buildSheetsPayload(log, now = new Date()) {
  return {
    entries: log.map((e) => ({
      task: e.task,
      start: e.start.toLocaleString(),
      end: e.end.toLocaleString(),
      duration: e.duration,
      note: e.note || '',
      date: e.date || todayStr(now),
    })),
  };
}
