// Floating widget: mounts the shared tracker UI inside a Shadow DOM on the page
// and adds widget-only chrome — drag, focus mode, collapse, saved position.
// All tracking behavior lives in the shared controller; the service worker owns
// the running timer and the idle/overrun alerts.

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
const settingsPanel = shadowRoot.getElementById('settings-panel');

// Restore saved position.
(async function () {
  try {
    const p = JSON.parse((await getStorage(SK.position)) || 'null');
    if (p?.left && p?.top) {
      tracker.style.bottom = 'auto'; tracker.style.right = 'auto';
      tracker.style.left = p.left; tracker.style.top = p.top;
    }
  } catch (e) {}
})();

collapseBtn.addEventListener('click', () => {
  const c = tracker.classList.toggle('collapsed');
  collapseBtn.textContent = c ? '+' : '−'; collapseBtn.title = c ? 'Expand' : 'Collapse';
  if (c) settingsPanel.classList.remove('open');
});

focusBtn.addEventListener('click', () => {
  const f = tracker.classList.toggle('focus-mode');
  focusBtn.title = f ? 'Exit focus' : 'Focus mode';
  focusBtn.classList.toggle('active-btn', f);
  if (f) tracker.classList.remove('collapsed');
});

// Drag the widget by its header; persist the final position.
(function () {
  let ox = 0, oy = 0, sx = 0, sy = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    const r = tracker.getBoundingClientRect();
    tracker.style.bottom = 'auto'; tracker.style.right = 'auto';
    tracker.style.top = r.top + 'px'; tracker.style.left = r.left + 'px';
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    tracker.classList.add('dragging');
    const mv = (e) => {
      tracker.style.left = Math.max(0, Math.min(ox + (e.clientX - sx), window.innerWidth - tracker.offsetWidth)) + 'px';
      tracker.style.top = Math.max(0, Math.min(oy + (e.clientY - sy), window.innerHeight - 40)) + 'px';
    };
    const up = async () => {
      tracker.classList.remove('dragging');
      try { await setStorage(SK.position, JSON.stringify({ left: tracker.style.left, top: tracker.style.top })); } catch (e) {}
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
})();
