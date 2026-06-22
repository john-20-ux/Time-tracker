// Summary aggregation — pure logic extracted from buildSummary() in content.js.
// Rendering stays in the UI; this only computes numbers (Phase 1 — no behavior change).

// Aggregate entries into per-task totals.
// Returns { agg, total, max, sorted } where:
//   agg    = { [taskName]: seconds }
//   total  = sum of all seconds
//   max    = largest single-task total (for bar scaling)
//   sorted = [[taskName, seconds], ...] descending by seconds
export function aggregateByTask(entries) {
  const agg = {};
  entries.forEach((e) => {
    if (!agg[e.task]) agg[e.task] = 0;
    agg[e.task] += e.durationSec || 0;
  });
  const values = Object.values(agg);
  const total = values.reduce((a, b) => a + b, 0);
  const max = values.length ? Math.max(...values) : 0;
  const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  return { agg, total, max, sorted };
}

// Bar width as a percentage of the largest task (0 when there's no data).
export function barPct(sec, max) {
  return max > 0 ? (sec / max) * 100 : 0;
}

// Goal progress for a task. Returns null when no goal is set.
// Otherwise { done, pct } where `done` means the goal was met.
export function goalProgress(sec, goalHours) {
  if (!goalHours || goalHours <= 0) return null;
  const hrs = sec / 3600;
  if (hrs >= goalHours) return { done: true, pct: 100 };
  return { done: false, pct: Math.round((hrs / goalHours) * 100) };
}

// Build a { [taskName]: goalHours } lookup from the task list.
export function goalMap(tasks) {
  const map = {};
  tasks.forEach((t) => {
    map[t.name] = t.goal || 0;
  });
  return map;
}
