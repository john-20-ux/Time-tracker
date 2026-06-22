// Toolbar popup — the primary UI. Injects the shared tracker markup + styles
// into the popup document and wires the shared controller. No Shadow DOM is
// needed (the popup owns its document) and there is no drag/focus/collapse.

import TRACKER_CSS from '../shared/styles.css';
import { TRACKER_HTML } from '../shared/markup.js';
import { mountTrackerUI } from '../shared/controller.js';

// Popup-specific layout: the shared CSS positions #tracker as a floating widget;
// here it fills the popup window instead, and widget-only chrome is hidden.
const POPUP_CSS = `
html{background:#f0ede8;}
body{min-height:0;display:block;width:340px;background:#f0ede8;}
#tracker{position:static;width:340px;border-radius:0;box-shadow:none;}
#tracker:hover{box-shadow:none;}
#header{cursor:default;border-radius:0;}
#focus-btn,#collapse-btn{display:none;}
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
