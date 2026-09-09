import { type ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// A local sync service, so the tests exercise the real network path without
// depending on the public service.
export const startSyncServer = async (): Promise<{
  url: string;
  port: number;
  stop: () => void;
}> => {
  const port = 3630 + Math.floor(Math.random() * 1000);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-sync-'));

  const server: ChildProcess = spawn(
    process.execPath,
    [path.join('node_modules', '.bin', 'automerge-repo-sync-server')],
    { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir } }
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('sync server did not start')),
      10_000
    );
    server.stdout?.on('data', (data: Buffer) => {
      if (data.toString().includes('Listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.on('error', reject);
  });

  return {
    url: `ws://127.0.0.1:${port}`,
    port,
    stop: () => {
      server.kill();
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {}
    },
  };
};
