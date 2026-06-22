# Time Tracker Pro

A Chrome extension (Manifest V3) that shows a floating time-tracking widget with
tasks & goals, focus mode, idle auto-stop, overrun alerts, history, summary
charts, and CSV / Google Sheets export.

> **Restructure in progress.** The codebase is being modularized in phases —
> see [RESTRUCTURE.md](./RESTRUCTURE.md) for the full plan and status.

## Project layout

```
src/
  core/      pure, framework-free logic (unit-tested): time, model, summary, export
  shared/    constants: defaults, colors, storage keys
  ui/
    widget/  the floating widget (content script + CSS)
  background/ service worker
test/        node:test unit tests for core/
build.mjs    esbuild bundler -> dist/
```

## Develop

```bash
npm install        # install esbuild (dev dependency)
npm run build      # bundle src/ -> dist/
npm run watch      # rebuild on change
npm test           # run unit tests (no deps, uses node:test)
```

## Load in Chrome

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select the generated **`dist/`** folder

The widget injects on every page; click the toolbar icon to toggle it.
