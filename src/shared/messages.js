// Message types exchanged between the widget (content script) and the service
// worker. The worker is the single source of truth for the running timer.

export const MSG = {
  // Widget -> worker: ask for the current active timer.
  //   reply: { activeTimer: { task, startTime } | null }
  GET_STATE: 'GET_STATE',

  // Widget -> worker: start tracking a task (replaces any running one).
  //   payload: { task }
  //   reply: { activeTimer: { task, startTime } }
  START_TIMER: 'START_TIMER',

  // Widget -> worker: stop the running timer.
  //   reply: { stopped: { task, startTime, endTime } | null }
  STOP_TIMER: 'STOP_TIMER',
};
