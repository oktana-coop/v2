// Launches a self-sufficient, isolated dev instance ("peer"): a full
// `electron-vite dev` with its own output dir (so parallel instances never
// clobber each other's bundles), its own Vite port (auto-picked), and its own
// persistent user-data dir under .dev-peers/ — own single-instance lock, own
// localStorage/config, remembered across runs.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/dev-peer.mjs <name>');
  process.exit(1);
}

const outDir = `dist-${name}`;
const userDataDir = resolve('.dev-peers', name);
mkdirSync(userDataDir, { recursive: true });

console.log(`[${name}] user data: ${userDataDir}`);
console.log(`[${name}] out dir: ${outDir}`);

const child = spawn(
  'pnpm',
  [
    'exec',
    'electron-vite',
    'dev',
    '-w',
    `--outDir=${outDir}`,
    '--',
    `--user-data-dir=${userDataDir}`,
  ],
  {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  }
);

child.on('exit', (code) => process.exit(code ?? 0));
