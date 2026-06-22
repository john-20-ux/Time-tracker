// Thin wrapper around chrome.storage.local.
// Shared by the service worker and the widget so both read/write the same way.

export async function getStorage(key) {
  const data = await chrome.storage.local.get([key]);
  return data[key] === undefined ? null : data[key];
}

export async function setStorage(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function removeStorage(key) {
  await chrome.storage.local.remove([key]);
}
