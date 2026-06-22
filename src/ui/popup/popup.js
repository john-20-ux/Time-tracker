// Toolbar popup — the primary UI. Injects the shared tracker markup + styles
// into the popup document and wires the shared controller. No Shadow DOM is
// needed (the popup owns its document) and there is no drag/focus.
//
// The − button here "pops out" a floating circle: it injects the widget into
// the current tab (via activeTab) in its minimized state, then closes the popup.

import TRACKER_CSS from '../shared/styles.css';
import { TRACKER_HTML } from '../shared/markup.js';
import { mountTrackerUI } from '../shared/controller.js';
import { setStorage } from '../../core/store.js';
import { SK } from '../../shared/constants.js';

// Popup-specific layout: the shared CSS positions #tracker as a floating widget;
// here it fills the popup window instead. Focus mode is hidden; the − button is
// kept and repurposed as "pop out floating circle".
const POPUP_CSS = `
html{background:#f0ede8;}
body{min-height:0;display:block;width:340px;background:#f0ede8;}
#tracker{position:static;width:340px;border-radius:0;box-shadow:none;}
#tracker:hover{box-shadow:none;}
#header{cursor:default;border-radius:0;}
#focus-btn{display:none;}
#body{max-height:520px;}
`;

const base = document.createElement('style');
base.textContent = TRACKER_CSS;
document.head.appendChild(base);

const overrides = document.createElement('style');
overrides.textContent = POPUP_CSS;
document.head.appendChild(overrides);

document.body.innerHTML = TRACKER_HTML;

mountTrackerUI(document);

// ─── POP OUT TO FLOATING CIRCLE ───────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2200);
}

async function popOutCircle() {
  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch (e) {}
  if (!tab || !tab.id) { toast('No active tab'); return; }
  try {
    // Set first so a freshly-injected widget mounts as a circle (no flash); an
    // already-present widget reacts to the change via storage.onChanged.
    await setStorage(SK.widgetMinimized, 'true');
    // activeTab grants access to this tab because the action was just invoked.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    window.close();
  } catch (e) {
    toast("Can't show the widget on this page");
  }
}

const popOutBtn = document.getElementById('collapse-btn');
popOutBtn.textContent = '⊙';
popOutBtn.title = 'Pop out a floating circle on this page';
popOutBtn.addEventListener('click', popOutCircle);
