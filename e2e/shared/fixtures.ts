import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { expect, test as base } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { startSyncServer, type SyncServer } from './sync-server';

export const launchElectronApp = ({
  userDataDir,
  syncServiceUrl,
}: {
  userDataDir: string;
  syncServiceUrl?: string;
}): Promise<ElectronApplication> =>
  electron.launch({
    args: [
      path.join(process.cwd(), 'dist-e2e/main/index.js'),
      `--user-data-dir=${userDataDir}`,
      // Pass --headless-window so the main process creates the BrowserWindow
      // with show:false. We use a custom argv flag rather than an env var
      // because electron-vite bakes process.env into the bundle at build time,
      // making runtime env vars invisible to the main process.
      //
      // TODO: Allow the main process to see runtime env, then read this from env.
      ...(process.env.HEADLESS === 'true' ? ['--headless-window'] : []),
    ],
    env: syncServiceUrl
      ? { ...process.env, E2E_SYNC_SERVICE_URL: syncServiceUrl }
      : undefined,
    timeout: 30_000,
  });

type Fixtures = {
  withSyncServer: boolean;
  syncServer: SyncServer | undefined;
  electronApp: ElectronApplication;
  window: Page;
  testProjectDir: string;
  emptyProjectDir: string;
  nestedProjectDir: string;
  longDocumentProjectDir: string;
};

export const test = base.extend<Fixtures>({
  // Set with `test.use` to run a local sync server that the app is launched
  // against. Otherwise the app uses the build-configured sync service.
  withSyncServer: [false, { option: true }],

  syncServer: async ({ withSyncServer }, use) => {
    if (!withSyncServer) {
      await use(undefined);
      return;
    }

    const syncServer = await startSyncServer();
    await use(syncServer);
    syncServer.stop();
  },

  electronApp: async ({ syncServer }, use) => {
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-userdata-')
    );

    const app = await launchElectronApp({
      userDataDir,
      syncServiceUrl: syncServer?.url,
    });
    await use(app);
    await app.close();

    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  },

  window: async ({ electronApp }, use) => {
    const win = await electronApp.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await use(win);
  },

  testProjectDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-'));
    fs.writeFileSync(
      path.join(dir, 'hello.md'),
      '# Hello\n\nThis is a test document.\n'
    );
    fs.writeFileSync(
      path.join(dir, 'world.md'),
      '# World\n\nAnother document.\n'
    );
    fs.writeFileSync(path.join(dir, 'config.json'), '{ "key": "value" }\n');
    await use(dir);

    // The Electron app is torn down after this fixture (Playwright teardown
    // order), so it may still hold file watchers on the directory. Ignore
    // cleanup errors — the OS will reclaim the temp directory.
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  },

  emptyProjectDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-empty-'));
    await use(dir);

    // The Electron app is torn down after this fixture (Playwright teardown
    // order), so it may still hold file watchers on the directory. Ignore
    // cleanup errors — the OS will reclaim the temp directory.
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  },

  nestedProjectDir: async ({}, use) => {
    // Directory structure:
    //
    //   alpha-folder/
    //     notes/
    //       nested-note.md
    //   beta-folder/
    //     beta-doc.md
    //     image1.png  (non-document file)
    //   gamma-folder/   (empty)
    //   armadillo.md
    //   zebra.md
    //
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-nested-'));

    const alphaDir = path.join(dir, 'alpha-folder');
    const notesDir = path.join(alphaDir, 'notes');
    const betaDir = path.join(dir, 'beta-folder');
    const gammaDir = path.join(dir, 'gamma-folder');
    fs.mkdirSync(alphaDir);
    fs.mkdirSync(notesDir);
    fs.mkdirSync(betaDir);
    fs.mkdirSync(gammaDir);

    // A non-document file inside beta-folder to verify it is removed along with
    // the folder even though the app does not treat it as a document.
    fs.writeFileSync(path.join(betaDir, 'image1.png'), 'untracked content\n');

    fs.writeFileSync(
      path.join(notesDir, 'nested-note.md'),
      '# Nested Note\n\nContent inside alpha folder.\n'
    );
    fs.writeFileSync(
      path.join(betaDir, 'beta-doc.md'),
      '# Beta Doc\n\nContent inside beta folder.\n'
    );

    // Root-level files — "armadillo" sorts before "zebra" alphabetically
    fs.writeFileSync(
      path.join(dir, 'armadillo.md'),
      '# Aardvark\n\nFirst file alphabetically.\n'
    );
    fs.writeFileSync(
      path.join(dir, 'zebra.md'),
      '# Zebra\n\nLast file alphabetically.\n'
    );

    await use(dir);

    // The Electron app is torn down after this fixture (Playwright teardown
    // order), so it may still hold file watchers on the directory. Ignore
    // cleanup errors — the OS will reclaim the temp directory.
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  },

  longDocumentProjectDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-long-doc-'));
    const paragraphs = Array.from(
      { length: 2000 },
      (_, index) => `Paragraph ${index + 1} of a long document.`
    );
    fs.writeFileSync(
      path.join(dir, 'chapter.md'),
      `# Chapter\n\n${paragraphs.join('\n\n')}\n`
    );
    await use(dir);

    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  },
});

export { expect };
