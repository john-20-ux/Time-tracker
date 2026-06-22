// Time Tracker service worker.
// Single source of truth for the running timer (Phase 3). The widget never
// owns "what is running" — it asks the worker and reflects the result. State is
// persisted to chrome.storage.local, so every open tab stays in sync via
// chrome.storage.onChanged and the timer survives tab reloads.

import { SK } from '../shared/constants.js';
import { MSG } from '../shared/messages.js';
import { getStorage, setStorage, removeStorage } from '../core/store.js';
import { startTimer, stopTimer } from '../core/timer.js';

console.log('Time Tracker Background Worker running');

// Read the active timer, or null when nothing is running.
async function getActive() {
  return (await getStorage(SK.activeTimer)) || null;
}

async function handleMessage(msg) {
  switch (msg && msg.type) {
    case MSG.GET_STATE:
      return { activeTimer: await getActive() };

    case MSG.START_TIMER: {
      // Starting a new task implicitly replaces any running one. The widget is
      // responsible for logging the replaced block (it has the note modal).
      const activeTimer = startTimer(msg.task);
      await setStorage(SK.activeTimer, activeTimer);
      return { activeTimer };
    }

    case MSG.STOP_TIMER: {
      const stopped = stopTimer(await getActive());
      if (!stopped) return { stopped: null };
      await removeStorage(SK.activeTimer);
      return { stopped };
    }

    default:
      return {};
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ error: String(e) }));
  return true; // keep the message channel open for the async response
});
