// Preload: exposes a minimal, safe IPC bridge to the renderer. The renderer's
// chrome-shim builds a chrome.storage/runtime facade on top of this so the
// shared controller runs unchanged. contextIsolation stays on; no Node in the page.

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('__tt', {
  storageGet: (keys) => ipcRenderer.invoke('storage:get', keys),
  storageSet: (obj) => ipcRenderer.invoke('storage:set', obj),
  storageRemove: (keys) => ipcRenderer.invoke('storage:remove', keys),
  onStorageChanged: (cb) => ipcRenderer.on('storage:changed', (_e, changes) => cb(changes)),
  sendMessage: (msg) => ipcRenderer.invoke('runtime:message', msg),
});
