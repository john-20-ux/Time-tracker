# Time Tracker — Desktop (Windows)

An Electron desktop build of the time tracker. It **reuses the extension's UI and
pure `core/` logic** (`../src`): the renderer mounts the same tracker UI through a
small `chrome` shim, and the Electron **main process** plays the role of the
extension's service worker — owning the running timer, idle auto-stop, overrun
alerts, native notifications, persistence, the system tray, and auto-launch.

## Behavior
- **System tray** icon with Open / Settings / Start-on-login / Quit.
- **Closing the window hides to tray**; the timer keeps running in the background.
- **Auto-launch on login** (enabled on first run; toggle from the tray).
- **Idle auto-stop** via the OS idle time; **overrun alerts** via native notifications.
- Data is stored in `tt-data.json` under the app's user-data folder.

## Develop / run (any OS with a desktop session)
```bash
cd desktop
npm install
npm start        # builds app/ then launches Electron
```

## Build a Windows artifact

**Portable build (works from macOS/Linux too — no installer):**
```bash
npm run pack:win     # -> release/win-unpacked/  (run "Time Tracker.exe")
```
Skips the Wine-based icon/version stamping, so the `.exe` runs but uses the
default Electron file icon (the in-app/tray icon is still correct). Zip
`release/win-unpacked/` to share it.

**Installer (recommended — needs Windows):**
```bash
npm run dist:win     # -> release/Time Tracker Setup <version>.exe  (NSIS)
```
The NSIS installer and `.exe` icon/metadata require a Windows toolchain. On
Apple-Silicon macOS this step can't run (the bundled Wine is Intel-only). Build
it on **Windows**, or use the **GitHub Actions workflow**
(`.github/workflows/desktop-build.yml`) — run it from the Actions tab or push a
`v*` tag, and download the installer from the run's artifacts.

## Notes
- The renderer is bundled by `build.mjs` (esbuild), reusing `../src/ui/shared`
  and `../src/core` so there is no logic duplication with the extension.
- `app/`, `release/`, and the generated icon are gitignored build output.
