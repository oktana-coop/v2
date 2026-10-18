// Launches a self-sufficient dev instance ("peer"): its own `electron-vite dev`
// with its own output dir, dependency cache, Vite port and persistent
// user-data dir, so several can run side by side and each builds what it runs.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
    env: {
      ...process.env,
      // Electron otherwise starts the bundle named in package.json's `main`,
      // which belongs to another instance.
      ELECTRON_ENTRY: join(outDir, 'main', 'index.js'),
      DEV_PEER_CACHE_DIR: resolve('node_modules', `.vite-${name}`),
    },
    // Electron runs as a grandchild (pnpm → electron-vite → Electron), so the
    // tree gets its own process group, letting it be stopped as one unit.
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
    stdio: 'inherit',
  }
);

const stopTree = (signal) => {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    } else {
      // A negative pid signals the whole process group, not just the child.
      process.kill(-child.pid, signal);
    }
  } catch {
    // Throws when the tree already exited, which is what we wanted.
  }
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopTree(signal);
    setTimeout(() => stopTree('SIGKILL'), 3000).unref();
  });
}

child.on('exit', (code) => process.exit(code ?? 0));
