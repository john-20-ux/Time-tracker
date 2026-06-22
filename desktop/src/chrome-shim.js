// Renderer-side shim: builds the small slice of the chrome.* API the shared
// controller/core use, backed by the preload IPC bridge (window.__tt). Imported
// for its side effect before mountTrackerUI runs.

const tt = window.__tt;
const changedCbs = [];
if (tt) tt.onStorageChanged((changes) => changedCbs.forEach((cb) => cb(changes, 'local')));

window.chrome = {
  storage: {
    local: {
      get: (keys) => tt.storageGet(keys),
      set: (obj) => tt.storageSet(obj),
      remove: (keys) => tt.storageRemove(keys),
    },
    onChanged: { addListener: (cb) => changedCbs.push(cb) },
  },
  runtime: {
    sendMessage: (msg) => tt.sendMessage(msg),
    onMessage: { addListener() {} },
  },
};
