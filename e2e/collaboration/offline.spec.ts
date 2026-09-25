import { Repo } from '@automerge/automerge-repo';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  expectNoErrorNotification,
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import { pointAppAtSyncServer, startSyncServer } from '../shared/sync-server';

type DocumentContent = { formatVersion: number; content: string };

// An app instance on a given user data dir, so a test can bring the same
// app back after closing it.
const launchApp = async (
  userDataDir: string
): Promise<{ app: ElectronApplication; window: Page }> => {
  const app = await electron.launch({
    args: [
      path.join(process.cwd(), 'dist/main/index.js'),
      `--user-data-dir=${userDataDir}`,
      ...(process.env.HEADLESS === 'true' ? ['--headless-window'] : []),
    ],
    timeout: 30_000,
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return { app, window };
};

const shareFromButton = async (window: Page): Promise<string> => {
  await window.getByRole('button', { name: 'Share Document' }).click();
  await window.getByRole('button', { name: 'Create share ID' }).click();

  const shown = window.getByTestId('share-id');
  await shown.waitFor({ state: 'visible', timeout: 10_000 });
  const shareId = await shown.textContent();
  expect(shareId).toMatch(/^automerge:/);

  const close = window.getByRole('button', { name: 'Close' });
  await close.click();
  await close.waitFor({ state: 'hidden', timeout: 5_000 });

  return shareId as string;
};

// A plain automerge-repo client at the service, standing in for a peer.
const connectPeer = (syncServerUrl: string) => {
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

const contentAtService = async ({
  url,
  shareId,
}: {
  url: string;
  shareId: string;
}): Promise<string> => {
  const peer = connectPeer(url);
  try {
    const handle = await peer.repo.find<DocumentContent>(
      shareId as Parameters<typeof peer.repo.find>[0],
      { signal: AbortSignal.timeout(15_000) }
    );
    return handle.fullDoc().content;
  } finally {
    peer.disconnect();
  }
};

test.describe('a shared document across a restart', () => {
  // Shared documents outlive the process, so typing made while the service
  // was out of reach is still there after a restart, and reaches the
  // service once it is back.
  test('reopens from local storage while the service is unreachable, and syncs what was typed offline once it is back', async () => {
    test.setTimeout(180_000);

    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-userdata-restart-')
    );
    const projectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-restart-')
    );
    fs.writeFileSync(
      path.join(projectDir, 'hello.md'),
      '# Hello\n\nThis is a test document.\n'
    );
    const serviceDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-sync-restart-')
    );
    let service = await startSyncServer({ dataDir: serviceDataDir });

    try {
      const first = await launchApp(userDataDir);
      await pointAppAtSyncServer({ window: first.window, url: service.url });
      await openProjectFolder({
        electronApp: first.app,
        window: first.window,
        folderPath: projectDir,
      });
      await openHelloMd({ window: first.window });
      const shareId = await shareFromButton(first.window);

      // The share reaches the service before the service goes away.
      expect(await contentAtService({ url: service.url, shareId })).toContain(
        'Hello'
      );
      service.stop();

      await typeInEditorSlowly({
        window: first.window,
        text: ' OFFLINE',
        delay: 30,
      });
      await expect
        .poll(
          () => fs.readFileSync(path.join(projectDir, 'hello.md'), 'utf8'),
          {
            timeout: 10_000,
          }
        )
        .toContain('OFFLINE');
      await first.app.close();

      const second = await launchApp(userDataDir);
      await openProjectFolder({
        electronApp: second.app,
        window: second.window,
        folderPath: projectDir,
      });
      await openHelloMd({ window: second.window });

      // Found in local storage, the document opens shared at once. Asking
      // the unreachable service instead would take its 10 s timeout and
      // open the document without sharing.
      await expect(
        second.window.getByRole('button', { name: 'Sharing Options' })
      ).toBeVisible({ timeout: 8_000 });
      await expect(second.window.locator('.ProseMirror')).toContainText(
        'OFFLINE'
      );
      await expectNoErrorNotification({ window: second.window });

      service = await startSyncServer({
        port: service.port,
        dataDir: serviceDataDir,
      });
      await expect
        .poll(() => contentAtService({ url: service.url, shareId }), {
          timeout: 30_000,
        })
        .toContain('OFFLINE');

      await second.app.close();
    } finally {
      service.stop();
      for (const dir of [userDataDir, projectDir, serviceDataDir]) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    }
  });
});
