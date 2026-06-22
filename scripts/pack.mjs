// Packages dist/ into a versioned zip for distribution (Chrome Web Store upload
// or self-hosted). Run `npm run pack` (it builds first). manifest.json ends up
// at the zip root, as Chrome requires.

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../dist/manifest.json', import.meta.url)));
const out = `time-tracker-v${version}.zip`;

rmSync(out, { force: true });
// No shell: args passed directly to zip, so nothing is interpolated into a command string.
execFileSync('zip', ['-qr', `../${out}`, '.', '-x', '.*'], { cwd: 'dist', stdio: 'inherit' });
console.log(`packed -> ${out}`);
