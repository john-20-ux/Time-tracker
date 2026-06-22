// Build script for Time Tracker Pro.
// Bundles the ES-module sources in src/ into a flat dist/ directory that can be
// loaded as an unpacked Chrome extension. Run `npm run build` or `npm run watch`.

import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

// Entry points -> dist/ output names referenced by manifest.json.
const entryPoints = {
  content: 'src/ui/widget/content.js',
  'service-worker': 'src/background/service-worker.js',
};

// Static files copied verbatim into dist/.
const staticFiles = [
  ['manifest.json', 'dist/manifest.json'],
  ['src/ui/widget/widget.css', 'dist/content.css'],
];

async function copyStatic() {
  await mkdir(outdir, { recursive: true });
  for (const [from, to] of staticFiles) {
    await cp(from, to);
  }
}

const buildOptions = {
  entryPoints,
  bundle: true,
  format: 'iife', // content scripts run as classic scripts, not modules
  target: 'chrome110',
  outdir,
  logLevel: 'info',
};

await rm(outdir, { recursive: true, force: true });

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  await copyStatic();
  console.log('watching for changes…');
} else {
  await esbuild.build(buildOptions);
  await copyStatic();
  console.log('build complete -> dist/');
}
