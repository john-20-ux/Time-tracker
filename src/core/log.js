// Shared day-log persistence, used by BOTH the widget and the service worker.
// Operations are read-modify-write against chrome.storage so the worker (idle
// auto-stop) and the widget (manual stop) can both append without clobbering
// each other. Entries store dates as ISO strings; the widget revives them.

import { SK } from '../shared/constants.js';
import { getStorage, setStorage } from './store.js';
import { todayStr } from './time.js';

function parseLog(raw) {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function parseHistory(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

// Append a finished entry to today's log and today's history bucket.
// `entry.start`/`entry.end` may be Date or ISO string; stored as ISO.
export async function appendEntry(entry) {
  const today = todayStr();
  const e = {
    ...entry,
    start: new Date(entry.start).toISOString(),
    end: new Date(entry.end).toISOString(),
  };
  const savedDate = await getStorage(SK.logDate);
  let log = parseLog(await getStorage(SK.log));
  let total = parseInt((await getStorage(SK.total)) || '0', 10);
  const history = parseHistory(await getStorage(SK.history));

  // Day rollover: archive the previous day's log before starting today's.
  if (savedDate && savedDate !== today) {
    if (log.length) history[savedDate] = log;
    log = [];
    total = 0;
  }

  log.push(e);
  total += entry.durationSec || 0;
  if (!history[today]) history[today] = [];
  history[today].push(e);

  await setStorage(SK.log, JSON.stringify(log));
  await setStorage(SK.total, String(total));
  await setStorage(SK.logDate, today);
  await setStorage(SK.history, JSON.stringify(history));
}

// Clear today's entries (log + total + today's history bucket).
export async function clearToday() {
  const today = todayStr();
  const history = parseHistory(await getStorage(SK.history));
  delete history[today];
  await setStorage(SK.log, JSON.stringify([]));
  await setStorage(SK.total, '0');
  await setStorage(SK.logDate, today);
  await setStorage(SK.history, JSON.stringify(history));
}
