// Floating widget: mounts the shared tracker UI inside a Shadow DOM on the page
// and adds widget-only chrome — drag, focus mode, minimize-to-circle, and saved
// position. All tracking behavior lives in the shared controller; the service
// worker owns the running timer and the idle/overrun alerts.

import TRACKER_CSS from '../shared/styles.css';
import { TRACKER_HTML } from '../shared/markup.js';
import { mountTrackerUI } from '../shared/controller.js';
import { getStorage, setStorage } from '../../core/store.js';
import { SK } from '../../shared/constants.js';

const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

const shadowHost = document.createElement('div');
shadowHost.id = 'time-tracker-ext-host';
document.body.appendChild(shadowHost);

const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

const style = document.createElement('style');
style.textContent = TRACKER_CSS;
shadowRoot.appendChild(style);

// Widget-only styles: the minimized floating circle.
const widgetStyle = document.createElement('style');
widgetStyle.textContent = `
#tracker.minimized{width:56px!important;min-width:0;height:56px;border-radius:50%;overflow:visible;}
#tracker.minimized > *{display:none!important;}
#tracker.minimized #mini-circle{display:flex!important;}
#mini-circle{display:none;width:56px;height:56px;border-radius:50%;background:#4a7c6f;color:#fff;
  flex-direction:column;align-items:center;justify-content:center;cursor:grab;user-select:none;
  font-family:'DM Sans',sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06);}
#mini-circle:active{cursor:grabbing;}
#mini-circle .mini-icon{font-size:22px;line-height:1;}
#mini-circle .mini-time{display:none;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.3px;}
#mini-circle.tracking .mini-icon{display:none;}
#mini-circle.tracking .mini-time{display:block;}
#mini-circle.tracking{animation:mini-pulse 1.7s infinite;}
@keyframes mini-pulse{0%,100%{box-shadow:0 0 0 0 rgba(74,124,111,.5)}50%{box-shadow:0 0 0 9px rgba(74,124,111,0)}}
`;
shadowRoot.appendChild(widgetStyle);

const container = document.createElement('div');
container.innerHTML = TRACKER_HTML;
shadowRoot.appendChild(container);

// Wire all tracking behavior.
mountTrackerUI(shadowRoot);

// ─── WIDGET-ONLY CHROME ───────────────────────────────────────────────────────
const tracker = shadowRoot.getElementById('tracker');
const header = shadowRoot.getElementById('header');
const focusBtn = shadowRoot.getElementById('focus-btn');
const collapseBtn = shadowRoot.getElementById('collapse-btn');

// The minimized circle (a floating button) lives inside #tracker.
const mini = document.createElement('div');
mini.id = 'mini-circle';
mini.title = 'Open Time Tracker';
mini.innerHTML = '<span class="mini-icon">⏱</span><span class="mini-time">00:00</span>';
tracker.appendChild(mini);
const miniTime = mini.querySelector('.mini-time');

function minimize() {
  tracker.classList.add('minimized');
  tracker.classList.remove('focus-mode');
  setStorage(SK.widgetMinimized, 'true').catch(() => {});
}
function restore() {
  tracker.classList.remove('minimized');
  setStorage(SK.widgetMinimized, 'false').catch(() => {});
}

// The − button now minimizes to the circle; clicking the circle restores.
collapseBtn.textContent = '−'; collapseBtn.title = 'Minimize';
collapseBtn.addEventListener('click', minimize);
mini.addEventListener('click', () => {
  if (mini._dragged) { mini._dragged = false; return; } // ignore the click ending a drag
  restore();
});

focusBtn.addEventListener('click', () => {
  const f = tracker.classList.toggle('focus-mode');
  focusBtn.title = f ? 'Exit focus' : 'Focus mode';
  focusBtn.classList.toggle('active-btn', f);
});

// Mirror the controller's live state (DOM-only, no coupling) into the circle:
// show the elapsed time + pulse while a task is tracking, else the ⏱ icon.
setInterval(() => {
  const tracking = shadowRoot.getElementById('pulse')?.classList.contains('on');
  mini.classList.toggle('tracking', !!tracking);
  if (tracking) {
    const [h, m, s] = (shadowRoot.getElementById('focus-timer')?.textContent || '00:00:00').split(':');
    miniTime.textContent = h === '00' ? `${m}:${s}` : `${h}:${m}`;
  }
}, 1000);

// Make an element drag the whole widget; persist the final position. The circle
// uses the same handler and flags a drag so the trailing click doesn't restore.
function enableDrag(handle) {
  let ox = 0, oy = 0, sx = 0, sy = 0, moved = false;
  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    moved = false;
    const r = tracker.getBoundingClientRect();
    tracker.style.bottom = 'auto'; tracker.style.right = 'auto';
    tracker.style.top = r.top + 'px'; tracker.style.left = r.left + 'px';
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    tracker.classList.add('dragging');
    const mv = (e) => {
      if (Math.abs(e.clientX - sx) > 3 || Math.abs(e.clientY - sy) > 3) moved = true;
      tracker.style.left = Math.max(0, Math.min(ox + (e.clientX - sx), window.innerWidth - tracker.offsetWidth)) + 'px';
      tracker.style.top = Math.max(0, Math.min(oy + (e.clientY - sy), window.innerHeight - tracker.offsetHeight)) + 'px';
    };
    const up = async () => {
      tracker.classList.remove('dragging');
      if (moved && handle === mini) mini._dragged = true;
      try { await setStorage(SK.position, JSON.stringify({ left: tracker.style.left, top: tracker.style.top })); } catch (e) {}
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
}
enableDrag(header);
enableDrag(mini);

// Restore saved position + minimized state.
(async function () {
  try {
    const p = JSON.parse((await getStorage(SK.position)) || 'null');
    if (p?.left && p?.top) {
      tracker.style.bottom = 'auto'; tracker.style.right = 'auto';
      tracker.style.left = p.left; tracker.style.top = p.top;
    }
  } catch (e) {}
  if ((await getStorage(SK.widgetMinimized)) === 'true') tracker.classList.add('minimized');
})();
