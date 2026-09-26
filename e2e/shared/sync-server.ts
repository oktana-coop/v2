import { Repo } from '@automerge/automerge-repo';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { expect } from '@playwright/test';
import { type ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
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

// A bare TCP listener standing in for the sync service. It answers nothing,
// so a test can check that the app never dialled it.
export const startTcpListener = async (): Promise<{
  url: string;
  expectNoConnectionsAfterWaiting: (ms?: number) => Promise<void>;
  stop: () => void;
}> => {
  let connectionCount = 0;
  const server = net.createServer(() => {
    connectionCount += 1;
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as net.AddressInfo;

  return {
    url: `ws://127.0.0.1:${port}`,
    expectNoConnectionsAfterWaiting: async (ms = 2_000) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      expect(connectionCount).toBe(0);
    },
    stop: () => server.close(),
  };
};

// Forwards TCP traffic to the sync server with a delay in both directions,
// standing in for the round-trip of a hosted sync service. setTimeout with a
// fixed delay preserves ordering, so frames arrive intact, just later.
export const startLatencyProxy = async ({
  targetPort,
  delayMs,
}: {
  targetPort: number;
  delayMs: number;
}): Promise<{ url: string; stop: () => void }> => {
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, '127.0.0.1');
    const forward = (from: net.Socket, to: net.Socket) => {
      from.on('data', (chunk) => {
        setTimeout(() => {
          if (!to.destroyed) to.write(chunk);
        }, delayMs);
      });
      from.on('close', () => {
        setTimeout(() => to.destroy(), delayMs);
      });
      from.on('error', () => to.destroy());
    };
    forward(client, upstream);
    forward(upstream, client);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as net.AddressInfo;

  return {
    url: `ws://127.0.0.1:${port}`,
    stop: () => server.close(),
  };
};

// A plain automerge-repo client of the sync server, standing in for a peer.
export const connectPeer = (syncServerUrl: string) => {
  const repo = new Repo({
    network: [new WebSocketClientAdapter(syncServerUrl)],
  });

  return {
    repo,
    disconnect: () => {
      for (const adapter of repo.networkSubsystem.adapters) {
        adapter.disconnect();
      }
    },
  };
};
