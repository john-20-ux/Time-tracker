// Electron main process — the desktop equivalent of the extension's service
// worker. It owns the running timer, idle auto-stop, overrun alerts, native
// notifications, the system tray, auto-launch, and persistent storage. It reuses
// the extension's pure core modules by providing a file-backed chrome.storage
// polyfill, so timer/log logic stays in one place.

import { app, BrowserWindow, Tray, Menu, ipcMain, Notification, powerMonitor, nativeImage } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { SK } from '../../src/shared/constants.js';
import { MSG } from '../../src/shared/messages.js';
// Pure core — only touches chrome.* at call time, which is after the polyfill
// below is installed, so static imports are safe.
import { startTimer, stopTimer, elapsedSeconds } from '../../src/core/timer.js';
import { appendEntry } from '../../src/core/log.js';
import { makeEntry } from '../../src/core/model.js';
import { getStorage, setStorage, removeStorage } from '../../src/core/store.js';

// ─── file-backed chrome.storage.local polyfill ───────────────────────────────
let DATA_FILE = null;
let data = {};
const changeListeners = [];

function persist() {
  if (!DATA_FILE) return;
  try { writeFileSync(DATA_FILE, JSON.stringify(data)); } catch (e) { console.error('persist failed', e); }
}
function emit(keys) {
  const changes = {};
  for (const k of keys) changes[k] = { newValue: data[k] };
  changeListeners.forEach((cb) => cb(changes, 'local'));
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('storage:changed', changes);
  }
}

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        const ks = Array.isArray(keys) ? keys : [keys];
        const o = {};
        for (const k of ks) if (k in data) o[k] = data[k];
        return o;
      },
      async set(obj) { Object.assign(data, obj); persist(); emit(Object.keys(obj)); },
      async remove(keys) { const ks = Array.isArray(keys) ? keys : [keys]; ks.forEach((k) => delete data[k]); persist(); emit(ks); },
    },
    onChanged: { addListener: (cb) => changeListeners.push(cb) },
  },
};

const ICON = path.join(__dirname, 'icon.png');
let mainWin = null;
let settingsWin = null;
let tray = null;
let overrunTimer = null;

// ─── worker logic (mirrors the extension service worker) ──────────────────────
const getActive = async () => (await getStorage(SK.activeTimer)) || null;
async function getSettings() {
  return {
    idleEnabled: (await getStorage(SK.idleOn)) === 'true',
    idleMins: parseInt((await getStorage(SK.idleMins)) || '5', 10),
    notifEnabled: (await getStorage(SK.notifOn)) === 'true',
    notifMins: parseInt((await getStorage(SK.notifMins)) || '90', 10),
  };
}
function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body, icon: ICON }).show();
}

async function scheduleOverrun() {
  clearTimeout(overrunTimer); overrunTimer = null;
  const active = await getActive();
  const { notifEnabled, notifMins } = await getSettings();
  if (!active || !notifEnabled) return;
  const delay = Math.max(1000, active.startTime + notifMins * 60000 - Date.now());
  const fire = async () => {
    const a = await getActive(); const s = await getSettings();
    if (!a || !s.notifEnabled) return;
    notify('⏱ Task Overrun', `"${a.task}" has been running over ${s.notifMins} min.`);
    overrunTimer = setTimeout(fire, s.notifMins * 60000);
  };
  overrunTimer = setTimeout(fire, delay);
}

async function autoStopIdle() {
  const { idleEnabled } = await getSettings();
  if (!idleEnabled) return;
  const active = await getActive();
  if (!active) return;
  const stopped = stopTimer(active);
  await removeStorage(SK.activeTimer);
  clearTimeout(overrunTimer);
  await appendEntry(makeEntry({
    task: stopped.task, start: new Date(stopped.startTime), end: new Date(stopped.endTime),
    elapsedSec: elapsedSeconds(stopped), note: '(auto-stopped: idle)',
  }));
  notify('⏸ Auto-stopped', `"${stopped.task}" stopped — you seemed idle.`);
}

function startIdleWatch() {
  setInterval(async () => {
    const { idleEnabled, idleMins } = await getSettings();
    if (idleEnabled && powerMonitor.getSystemIdleTime() >= idleMins * 60) await autoStopIdle();
  }, 15000);
  powerMonitor.on('lock-screen', autoStopIdle);
}

async function handleMessage(msg) {
  switch (msg && msg.type) {
    case MSG.GET_STATE:
      return { activeTimer: await getActive() };
    case MSG.START_TIMER: {
      const activeTimer = startTimer(msg.task);
      await setStorage(SK.activeTimer, activeTimer);
      scheduleOverrun();
      return { activeTimer };
    }
    case MSG.STOP_TIMER: {
      const stopped = stopTimer(await getActive());
      await removeStorage(SK.activeTimer);
      clearTimeout(overrunTimer);
      return { stopped: stopped || null };
    }
    case MSG.OPEN_OPTIONS:
      openSettings();
      return {};
    default:
      return {};
  }
}

// ─── windows + tray ───────────────────────────────────────────────────────────
function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 380, height: 600, icon: ICON, show: true, title: 'Time Tracker',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  mainWin.loadFile(path.join(__dirname, 'window.html'));
  mainWin.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWin.hide(); } // close = hide to tray
  });
}
function showMain() {
  if (!mainWin || mainWin.isDestroyed()) createMainWindow();
  else { mainWin.show(); mainWin.focus(); }
}
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 480, height: 620, icon: ICON, title: 'Time Tracker — Settings', parent: mainWin || undefined,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  settingsWin.loadFile(path.join(__dirname, 'options.html'));
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(ICON));
  tray.setToolTip('Time Tracker');
  const refresh = () => {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Time Tracker', click: showMain },
      { label: 'Settings…', click: openSettings },
      { type: 'separator' },
      {
        label: 'Start on login', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => { app.setLoginItemSettings({ openAtLogin: item.checked }); },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
  };
  refresh();
  tray.on('click', showMain);
}

// ─── lifecycle ────────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMain);

  app.whenReady().then(() => {
    DATA_FILE = path.join(app.getPath('userData'), 'tt-data.json');
    try { data = JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch (e) { data = {}; }

    // Enable auto-launch once on first run (user can toggle it in the tray).
    if (!data.__autostartInit) {
      app.setLoginItemSettings({ openAtLogin: true });
      data.__autostartInit = true; persist();
    }

    ipcMain.handle('storage:get', (_e, keys) => chrome.storage.local.get(keys));
    ipcMain.handle('storage:set', (_e, obj) => chrome.storage.local.set(obj));
    ipcMain.handle('storage:remove', (_e, keys) => chrome.storage.local.remove(keys));
    ipcMain.handle('runtime:message', (_e, msg) => handleMessage(msg));

    buildTray();
    createMainWindow();
    startIdleWatch();
    scheduleOverrun();
  });

  // Keep running in the tray when all windows are closed.
  app.on('window-all-closed', () => {});
}
