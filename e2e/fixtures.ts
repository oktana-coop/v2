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
    fs.rmSync(dir, { recursive: true, force: true });
  },
});

export { expect };
