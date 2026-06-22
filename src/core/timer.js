// Pure timer state transitions. The service worker composes these with storage;
// keeping them pure means the start/stop logic is unit-testable without Chrome.

// Begin tracking a task. Returns the new active-timer record.
export function startTimer(task, now = Date.now()) {
  return { task, startTime: now };
}

// Stop the given active timer. Returns the finished block, or null when nothing
// was running.
export function stopTimer(active, now = Date.now()) {
  if (!active) return null;
  return { task: active.task, startTime: active.startTime, endTime: now };
}

// Elapsed whole seconds for a finished block.
export function elapsedSeconds({ startTime, endTime }) {
  return Math.max(0, Math.round((endTime - startTime) / 1000));
}
