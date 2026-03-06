import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { expect, test as base } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Fixtures = {
  electronApp: ElectronApplication;
  window: Page;
  testProjectDir: string;
  emptyProjectDir: string;
  nestedProjectDir: string;
};

export const test = base.extend<Fixtures>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.join(process.cwd(), 'dist/main/index.js')],
      timeout: 30_000,
    });
    await use(app);
    await app.close();
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
    //   armadillo.md
    //   zebra.md
    //
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-nested-'));

    const alphaDir = path.join(dir, 'alpha-folder');
    const notesDir = path.join(alphaDir, 'notes');
    const betaDir = path.join(dir, 'beta-folder');
    fs.mkdirSync(alphaDir);
    fs.mkdirSync(notesDir);
    fs.mkdirSync(betaDir);

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
});

export { expect };
