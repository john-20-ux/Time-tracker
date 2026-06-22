// Time Tracker service worker.
// Single source of truth for the running timer (Phase 3) and owner of the
// idle/overrun alerts (Phase 4). Idle detection (chrome.idle) and overrun
// alarms (chrome.alarms) run here so they fire reliably even when no tab is
// focused — and survive the worker itself being suspended.

import { SK } from '../shared/constants.js';
import { MSG } from '../shared/messages.js';
import { getStorage, setStorage, removeStorage } from '../core/store.js';
import { startTimer, stopTimer, elapsedSeconds } from '../core/timer.js';
import { makeEntry } from '../core/model.js';
import { appendEntry } from '../core/log.js';

const ALARM_OVERRUN = 'tt-overrun';

console.log('Time Tracker Background Worker running');

async function getActive() {
  return (await getStorage(SK.activeTimer)) || null;
}

async function getSettings() {
  return {
    idleEnabled: (await getStorage(SK.idleOn)) === 'true',
    idleMins: parseInt((await getStorage(SK.idleMins)) || '5', 10),
    notifEnabled: (await getStorage(SK.notifOn)) === 'true',
    notifMins: parseInt((await getStorage(SK.notifMins)) || '90', 10),
  };
}

function notify(title, message) {
  try {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title, message });
  } catch (e) {
    console.error('notification failed', e);
  }
}

// ─── OVERRUN (chrome.alarms) ─────────────────────────────────────────────────
// Schedule an alarm at startTime + notifMins, repeating every notifMins. Using
// an absolute `when` keeps the alert correct relative to the real start even if
// the worker restarts mid-session.
async function scheduleOverrun() {
  await chrome.alarms.clear(ALARM_OVERRUN);
  const active = await getActive();
  const { notifEnabled, notifMins } = await getSettings();
  if (!active || !notifEnabled) return;
  const fireAt = active.startTime + notifMins * 60 * 1000;
  chrome.alarms.create(ALARM_OVERRUN, {
    when: Math.max(Date.now() + 1000, fireAt),
    periodInMinutes: notifMins,
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_OVERRUN) return;
  const active = await getActive();
  const { notifEnabled, notifMins } = await getSettings();
  if (!active || !notifEnabled) {
    await chrome.alarms.clear(ALARM_OVERRUN);
    return;
  }
  notify('⏱ Task Overrun', `"${active.task}" has been running over ${notifMins} min.`);
});

// ─── IDLE (chrome.idle) ──────────────────────────────────────────────────────
// Chrome enforces a 15s minimum detection interval.
async function refreshIdleDetection() {
  const { idleMins } = await getSettings();
  try {
    chrome.idle.setDetectionInterval(Math.max(15, idleMins * 60));
  } catch (e) {
    console.error('setDetectionInterval failed', e);
  }
}

chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === 'active') return; // 'idle' or 'locked'
  const { idleEnabled } = await getSettings();
  if (!idleEnabled) return;
  const active = await getActive();
  if (!active) return;
  // Auto-stop: stop the timer and log the block with an idle note.
  const stopped = stopTimer(active);
  await removeStorage(SK.activeTimer);
  await chrome.alarms.clear(ALARM_OVERRUN);
  await appendEntry(
    makeEntry({
      task: stopped.task,
      start: new Date(stopped.startTime),
      end: new Date(stopped.endTime),
      elapsedSec: elapsedSeconds(stopped),
      note: '(auto-stopped: idle)',
    }),
  );
  notify('⏸ Auto-stopped', `"${stopped.task}" stopped — you seemed idle.`);
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────
async function handleMessage(msg) {
  switch (msg && msg.type) {
    case MSG.GET_STATE:
      return { activeTimer: await getActive() };

    case MSG.START_TIMER: {
      const activeTimer = startTimer(msg.task);
      await setStorage(SK.activeTimer, activeTimer);
      await scheduleOverrun();
      return { activeTimer };
    }

    case MSG.STOP_TIMER: {
      const stopped = stopTimer(await getActive());
      await removeStorage(SK.activeTimer);
      await chrome.alarms.clear(ALARM_OVERRUN);
      return { stopped: stopped || null };
    }

    case MSG.OPEN_OPTIONS:
      chrome.runtime.openOptionsPage();
      return {};

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

// React to settings changes from the widget: reschedule overrun + idle.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (SK.notifOn in changes || SK.notifMins in changes) scheduleOverrun();
  if (SK.idleMins in changes) refreshIdleDetection();
});

// On worker startup, restore detection interval and any pending overrun alarm.
refreshIdleDetection();
scheduleOverrun();
