import { type ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export type SyncServer = {
  url: string;
  port: number;
  stop: () => void;
};

// Runs automerge-repo-sync-server locally, in place of the build-configured
// sync server. Passing the same port and data dir brings a stopped server back
// with its documents.
export const startSyncServer = async ({
  port = 3630 + Math.floor(Math.random() * 1000),
  dataDir,
}: {
  port?: number;
  dataDir?: string;
} = {}): Promise<SyncServer> => {
  const resolvedDataDir =
    dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-sync-'));

  const server: ChildProcess = spawn(
    process.execPath,
    [path.join('node_modules', '.bin', 'automerge-repo-sync-server')],
    { env: { ...process.env, PORT: String(port), DATA_DIR: resolvedDataDir } }
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
      if (dataDir !== undefined) return;
      try {
        fs.rmSync(resolvedDataDir, { recursive: true, force: true });
      } catch {}
    },
  };
};
