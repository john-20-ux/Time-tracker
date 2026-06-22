// Pure time/date formatting helpers.
// Extracted verbatim from content.js (Phase 1 — no behavior change).

// Zero-pad a number to two digits: 3 -> "03".
export const pad = (n) => String(n).padStart(2, '0');

// Format a duration in seconds as HH:MM:SS.
export const fmt = (s) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

// Format a date/timestamp as a short local time, e.g. "09:42 AM".
export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Today's date as a "YYYY-MM-DD" string in local time.
// Accepts an optional date for testability; defaults to now.
export const todayStr = (now = new Date()) => {
  const d = now;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Human label for a "YYYY-MM-DD" string: "Today", "Yesterday", or a short date.
// `now` is injectable so the relative labels can be tested deterministically.
export const dateLabel = (ds, now = new Date()) => {
  const t = todayStr(now);
  if (ds === t) return 'Today';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const ys = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  if (ds === ys) return 'Yesterday';
  return new Date(ds + 'T00:00:00').toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};
