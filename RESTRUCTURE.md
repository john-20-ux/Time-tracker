# Time Tracker Pro — Restructure Plan

> A proposal for rebuilding the existing single-file Chrome extension into a
> maintainable, modular, and more reliable time-tracking tool — without losing
> any of the features you use today.

---

## 1. Where it stands today

| Area | Current reality |
|------|-----------------|
| **Type** | Chrome extension, Manifest V3 |
| **Injection** | Content script on `<all_urls>` — the widget renders on *every* page, in *every* tab |
| **Code shape** | One 966-line `content.js` holding HTML (string), CSS (string), state, and all logic |
| **Background worker** | `background.js` is empty (`console.log` only) despite `alarms` + `notifications` permissions |
| **`content.css`** | Empty — real styles live inside `content.js` |
| **Storage** | `chrome.storage.local`, keys prefixed `tt3_` |
| **State** | Lives per-tab inside the content script — two open tabs = two separate timers that can disagree |

### Features that must survive the rebuild
- Task list with per-task **goal hours**
- Live timer with start/stop and **task switching** (auto-logs the previous task)
- **Focus mode** (collapses widget to a small pill) and collapse
- **Idle detection** → auto-stop after N minutes of no input
- **Overrun alerts** → notify when a task runs longer than N minutes
- **Note modal** on stop
- **Today's log** + **per-day history** (auto-archived at date rollover)
- **Summary** tab with per-task bar chart and goal progress
- **CSV export** and **Google Sheets push** (via Apps Script Web App URL)
- **Draggable** widget with remembered position

---

## 2. Core problems to fix

1. **One giant file.** HTML, CSS, state, and logic are impossible to navigate or test in isolation.
2. **State is per-tab.** Each tab runs its own copy of the timer. The "running task" is not shared, so the same session can look different in two tabs and writes can race on `chrome.storage`.
3. **Dead background worker.** Timers (`setInterval`/`setTimeout`) live in the page. Closing the tab kills the timer; overrun/idle alerts depend on the page staying open. This is what the service worker + `alarms` should own.
4. **Injected everywhere.** Running on `<all_urls>` means the widget fights with every site's CSS/z-index and runs needless code on pages you're not tracking from.
5. **No build / no tests / no types.** Pure string concatenation, no way to catch regressions.

---

## 3. Target architecture

The cleanest fit for "I want to manage my time while I work" is to move the
primary UI **out of the page** and into the extension's own surfaces, with a
**single source of truth** in the service worker.

```
┌──────────────────────────────────────────────────────────────┐
│                     Service Worker (background)                │
│   • The ONLY owner of timer state (running task, startTime)    │
│   • Uses chrome.alarms for idle + overrun (survives tab close) │
│   • chrome.idle API for real idle detection (not mousemove)    │
│   • Reads/writes chrome.storage, broadcasts state changes      │
│   • Handles date rollover + history archiving                  │
└───────────────▲───────────────────────────▲──────────────────┘
                │ messages (runtime.port)    │
        ┌───────┴────────┐          ┌─────────┴──────────┐
        │   Popup UI     │          │  Floating Widget   │
        │ (toolbar icon) │          │ (optional, opt-in) │
        │ Track/Summary/ │          │  content script,   │
        │ History tabs   │          │  Shadow DOM        │
        └────────────────┘          └────────────────────┘
                │
        ┌───────┴────────┐
        │  Options page  │  ← Tasks, goals, idle/overrun, Sheets URL
        └────────────────┘
```

### Why this shape
- **Popup as the main UI.** Click the toolbar icon → full Track / Summary / History interface. No more fighting host-page CSS, no per-tab duplication.
- **Service worker owns state.** One running timer for the whole browser. Alarms fire even when no tab is focused, so overrun/idle alerts become reliable.
- **Floating widget becomes opt-in.** Keep it for the "always visible while I work" feel, but as a thin view that reflects worker state — not its own brain. Restrict it to sites you choose instead of `<all_urls>`.
- **Options page** for configuration that doesn't belong in a cramped widget.

---

## 4. Proposed file structure

```
time-tracker/
├── manifest.json
├── README.md
├── RESTRUCTURE.md
├── package.json                 # build + test scripts
│
├── src/
│   ├── background/
│   │   ├── service-worker.js     # entry; wires modules below
│   │   ├── timer.js              # start/stop/switch — single source of truth
│   │   ├── alarms.js             # chrome.alarms: overrun + idle scheduling
│   │   ├── idle.js               # chrome.idle integration
│   │   └── rollover.js           # date-change → archive today's log
│   │
│   ├── core/                     # pure, framework-free, unit-testable
│   │   ├── store.js              # storage adapter (get/set/remove + schema)
│   │   ├── model.js              # Task / Entry / Day types + factories
│   │   ├── time.js               # pad, fmt, fmtTime, todayStr, dateLabel
│   │   ├── summary.js            # aggregate entries → per-task totals + goals
│   │   └── export.js             # CSV builder + Sheets payload builder
│   │
│   ├── ui/
│   │   ├── popup/                # main UI (HTML + CSS + JS)
│   │   │   ├── popup.html
│   │   │   ├── popup.css
│   │   │   └── popup.js
│   │   ├── options/              # tasks, goals, alerts, Sheets config
│   │   │   ├── options.html
│   │   │   ├── options.css
│   │   │   └── options.js
│   │   └── widget/               # optional floating widget
│   │       ├── content.js        # mounts Shadow DOM, subscribes to worker
│   │       └── widget.css
│   │
│   └── shared/
│       ├── messages.js           # message type constants + helpers
│       └── constants.js          # storage keys, defaults, task colors
│
└── test/
    ├── time.test.js
    ├── summary.test.js
    └── export.test.js
```

The key move: **`core/` is plain JS with no Chrome APIs**, so it can be unit
tested in Node. Everything Chrome-specific stays in `background/` and `ui/`.

---

## 5. Data model

Keep it close to today's shape so migration is trivial — just give it names.

```js
// Task
{ id: string, name: string, emoji: string, goalHours: number, color: string }

// Entry (one tracked block)
{ id: string, taskId: string, taskName: string,
  start: ISOString, end: ISOString, durationSec: number,
  note: string, date: "YYYY-MM-DD" }

// Storage layout (chrome.storage.local)
{
  tasks:        Task[],
  activeTimer:  { taskId, startTime } | null,   // ← now owned by worker
  today:        { date: "YYYY-MM-DD", entries: Entry[] },
  history:      { [date]: Entry[] },             // archived past days
  settings:     { idleEnabled, idleMins, overrunEnabled, overrunMins, sheetsUrl },
  ui:           { widgetEnabled, widgetPosition }
}
```

**Migration:** on first run of the new version, read the old `tt3_*` keys, map
them into the new layout, write once, then mark `schemaVersion: 2`. The existing
`localStorage → chrome.storage` migration already shows the pattern.

---

## 6. State flow (single source of truth)

```
User clicks a task in popup
        │
        ▼
popup → message {type: START_TIMER, taskId} → service worker
        │
        ▼
worker: stop+log current (if any) → set activeTimer → schedule alarms
        │
        ▼
worker broadcasts {type: STATE_CHANGED, state} to all open views
        │
        ▼
popup + widget both re-render from the same state
```

- The **elapsed seconds** shown ticking is computed in each view as
  `now - activeTimer.startTime` — views own only a display interval, never the
  truth. Close every tab and the timer keeps running in the worker.
- **Idle**: use `chrome.idle.onStateChanged` (real OS-level idle) instead of
  listening to `mousemove`/`scroll` on one page.
- **Overrun**: `chrome.alarms.create` so it fires regardless of which tab is open.

---

## 7. Build & tooling (lightweight on purpose)

You don't need a framework. Recommended minimal stack:

- **esbuild** or **Vite** to bundle `src/` → `dist/` (handles ES modules, fast).
- **Vitest** (or plain `node:test`) for the `core/` unit tests.
- **TypeScript optional** — even just `// @ts-check` + JSDoc on `core/` would
  catch most bugs without a full migration.

`package.json` scripts:
```json
{
  "scripts": {
    "build": "node build.mjs",
    "watch": "node build.mjs --watch",
    "test":  "vitest run"
  }
}
```
Load `dist/` as the unpacked extension during development.

---

## 8. Manifest changes

```jsonc
{
  "manifest_version": 3,
  "name": "Time Tracker Pro",
  "version": "2.0",
  "permissions": ["storage", "alarms", "notifications", "idle"],
  "action": { "default_popup": "popup.html" },   // ← real popup UI
  "options_page": "options.html",
  "background": { "service_worker": "service-worker.js", "type": "module" },
  "host_permissions": [],                          // ← drop <all_urls>
  "optional_host_permissions": ["<all_urls>"]      // ← widget asks only if enabled
}
```

- Move the day-to-day UI into the **popup**.
- Make the **floating widget opt-in** with `optional_host_permissions`, so it's
  only injected where you ask for it — no more running on every page.
- Add `idle` permission for proper idle detection.

---

## 9. Suggested migration path (incremental, low-risk)

Each phase leaves a working extension.

1. **Carve out `core/`.** Extract pure helpers (`time`, `summary`, `export`,
   `model`, `store`) from `content.js` into modules + add unit tests. No
   behavior change.
2. **Stand up the build.** Add esbuild/Vite so modules bundle into `dist/`.
   Extension still behaves identically.
3. **Move state into the service worker.** Worker becomes the single owner of
   `activeTimer`; views message it. Fixes the per-tab drift.
4. **Move alarms to the worker** (`chrome.alarms` + `chrome.idle`). Overrun and
   idle now survive tab close.
5. **Build the popup UI** from the existing markup/CSS (they're already written
   — just split HTML into `popup.html`, CSS into `popup.css`).
6. **Add the options page** for tasks/goals/settings/Sheets.
7. **Refactor the widget** into a thin opt-in view that subscribes to worker
   state, gated behind `optional_host_permissions`.

---

## 10. Optional improvements worth considering

- **Edit / delete log entries** (today's log is currently append-only except a full clear).
- **Weekly summary** view (you only have per-day today).
- **Keyboard command** (`chrome.commands`) to start/stop the last task without opening anything.
- **Badge text** on the toolbar icon showing the running task's elapsed minutes.
- **Backup/restore** as a single JSON export (in addition to CSV).
- **Sync vs local** — `chrome.storage.sync` for settings/tasks (carries across machines), keep large logs in `local`.

---

## 11. Decisions

Resolved as the restructure progressed:

1. **Primary surface** → **Popup as primary** (decided). The main
   Track/Summary/History UI will move into the toolbar popup (Phase 5); the
   floating widget becomes a small optional always-on-top view, made opt-in per
   site in Phase 7.
2. **Where should the widget appear** — _open._ Leaning opt-in per site
   (`optional_host_permissions`) rather than `<all_urls>`; finalize in Phase 7.
3. **Build tooling** → **esbuild + npm** (done in Phase 2).
4. **TypeScript** → staying with JSDoc-annotated JS for now.

## 12. Status

- ✅ Phase 1 — pure `core/` modules + tests
- ✅ Phase 2 — esbuild build pipeline; `content.js` consumes `core/`
- ✅ Phase 3 — service worker owns the running timer
- ✅ Security — closed stored-XSS path (untrusted localStorage + innerHTML)
- ✅ Phase 4 — idle + overrun moved into the worker (chrome.idle / chrome.alarms)
- ✅ Smoke tests — worker + widget integration harnesses (also fixed missing
  note-modal/toast markup)
- ✅ Phase 5 — popup UI (primary surface) + shared `mountTrackerUI` controller
- ✅ Phase 6 — dedicated options page (settings moved out of the gear panel)
- ✅ Phase 7 — opt-in floating widget (optional_host_permissions + chrome.scripting)
```
