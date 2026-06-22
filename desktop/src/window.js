// Main window renderer: mounts the shared tracker UI, filling the desktop
// window. The gear opens the settings window (OPEN_OPTIONS -> main process).

import './chrome-shim.js';
import TRACKER_CSS from '../../src/ui/shared/styles.css';
import { TRACKER_HTML } from '../../src/ui/shared/markup.js';
import { mountTrackerUI } from '../../src/ui/shared/controller.js';

// Desktop layout: fill the window; drag it by the header; hide widget-only
// buttons (focus/minimize) that don't apply to a real window.
const DESKTOP_CSS = `
html,body{margin:0;background:#f0ede8;}
body{display:block;}
#tracker{position:static;width:100vw;min-height:100vh;border-radius:0;box-shadow:none;}
#tracker:hover{box-shadow:none;}
#header{cursor:default;border-radius:0;-webkit-app-region:drag;}
#header button{-webkit-app-region:no-drag;}
#focus-btn,#collapse-btn{display:none;}
#body{max-height:none;}
`;

const base = document.createElement('style'); base.textContent = TRACKER_CSS; document.head.appendChild(base);
const ov = document.createElement('style'); ov.textContent = DESKTOP_CSS; document.head.appendChild(ov);

document.body.innerHTML = TRACKER_HTML;
mountTrackerUI(document);
