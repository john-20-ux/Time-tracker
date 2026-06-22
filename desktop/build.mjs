// Builds the Electron app into desktop/app/:
//   - main process + preload bundled to CJS (electron kept external)
//   - renderer entries bundled to IIFE (browser), reusing ../../src UI + core
//   - HTML copied; shared styles.css imported as text by the renderer bundles
// Run via `npm run build` (or implicitly by `start` / `dist:win`).

import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const outdir = 'app';
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

// Main + preload: Node/CJS, electron external (provided by the runtime).
await esbuild.build({
  entryPoints: { main: 'src/main.js', preload: 'src/preload.js' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outExtension: { '.js': '.cjs' },
  external: ['electron'],
  outdir,
  logLevel: 'info',
});

// Renderer: browser IIFE, reuses the extension's shared UI + core modules.
await esbuild.build({
  entryPoints: { window: 'src/window.js', options: 'src/options.js' },
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  loader: { '.css': 'text' },
  outdir,
  logLevel: 'info',
});

await cp('src/window.html', `${outdir}/window.html`);
await cp('src/options.html', `${outdir}/options.html`);

// Ensure the build icon exists (electron-builder reads build/icon.png).
if (!existsSync('build/icon.png')) {
  execFileSync('node', ['scripts/gen-icon.mjs'], { stdio: 'inherit' });
}
await cp('build/icon.png', `${outdir}/icon.png`); // also used for tray/notifications

console.log('desktop build complete -> app/');
