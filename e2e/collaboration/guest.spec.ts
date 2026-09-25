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
  expectNoOpenDocument,
  openCommandPalette,
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import { startSyncServer } from '../shared/sync-server';

// Shares the open document from the palette and returns its share ID.
const shareCurrentDocument = async ({
  window,
}: {
  window: Page;
}): Promise<string> => {
  await openCommandPalette({ window });

  const shareOption = window.getByRole('option', {
    name: 'Share this document',
  });
  await shareOption.waitFor({ state: 'visible', timeout: 2_000 });
  await shareOption.click();

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

// A second, fully independent app instance with its own user data: a guest's
// machine, holding no project unless the test opens one.
const launchSecondApp = async (): Promise<{
  app: ElectronApplication;
  window: Page;
  close: () => Promise<void>;
}> => {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'v2-e2e-userdata-guest-')
  );

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

  return {
    app,
    window,
    close: async () => {
      await app.close();
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {}
    },
  };
};

const pointAtSyncServer = (window: Page, url: string) =>
  window.evaluate((syncServiceUrl) => {
    localStorage.setItem('syncServiceUrl', syncServiceUrl);
  }, url);

test.describe('guest editing', () => {
  let syncServer: Awaited<ReturnType<typeof startSyncServer>>;

  test.beforeEach(async ({ window }) => {
    syncServer = await startSyncServer();
    await pointAtSyncServer(window, syncServer.url);
  });

  test.afterEach(() => {
    syncServer.stop();
  });

  test('a guest joins from the project selection screen, edits with the host, and leaves', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const shareId = await shareCurrentDocument({ window });

    const guest = await launchSecondApp();
    try {
      await pointAtSyncServer(guest.window, syncServer.url);

      // No project open: the project selection screen offers to join.
      await guest.window
        .getByRole('button', { name: 'Join shared document' })
        .click();
      const input = guest.window.getByPlaceholder('Share ID');
      await input.fill(shareId);
      await input.press('Enter');

      const guestEditor = guest.window.locator('.ProseMirror');
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await expect(guest.window).toHaveTitle('v2 | hello');
      // Listed under the name the share carries.
      const listed = guest.window.getByTestId('guest-share');
      await expect(listed).toHaveCount(1);
      await expect(listed).toContainText('hello');

      // Edits flow both ways.
      await typeInEditorSlowly({
        window: guest.window,
        text: ' guest',
        delay: 30,
      });
      await expect(window.locator('.ProseMirror')).toContainText('guest', {
        timeout: 20_000,
      });
      await typeInEditorSlowly({ window, text: ' host', delay: 30 });
      await expect(guestEditor).toContainText('host', { timeout: 20_000 });

      // Each sees the other.
      await expect(window.getByTestId('presence-avatar')).toHaveCount(1, {
        timeout: 20_000,
      });
      await expect(guest.window.getByTestId('presence-avatar')).toHaveCount(1, {
        timeout: 20_000,
      });

      // Leaving returns to the list, which no longer holds the share.
      await guest.window
        .getByRole('button', { name: 'Sharing Options' })
        .click();
      await guest.window
        .getByRole('dialog')
        .getByRole('button', { name: 'Leave' })
        .click();
      await expect(guest.window.getByTestId('guest-share')).toHaveCount(0);
      await expect(
        guest.window
          .getByRole('button', { name: 'Join shared document' })
          .first()
      ).toBeVisible();
    } finally {
      await guest.close();
    }
  });

  test('a share this project cannot take up is offered as a guest', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    // The host shares a document the other project does not have.
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await window.getByText('world').click();
    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
    const shareId = await shareCurrentDocument({ window });

    const other = await launchSecondApp();
    const otherProjectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-other-')
    );
    fs.writeFileSync(
      path.join(otherProjectDir, 'hello.md'),
      '# Hello\n\nAnother project.\n'
    );
    try {
      await pointAtSyncServer(other.window, syncServer.url);
      await openProjectFolder({
        electronApp: other.app,
        window: other.window,
        folderPath: otherProjectDir,
      });
      await openHelloMd({ window: other.window });

      await openCommandPalette({ window: other.window });
      const joinOption = other.window.getByRole('option', {
        name: 'Join shared document',
      });
      await joinOption.waitFor({ state: 'visible', timeout: 2_000 });
      await joinOption.click();
      const input = other.window.getByPlaceholder('Share ID');
      await input.fill(shareId);
      await input.press('Enter');

      await expect(other.window.getByTestId('join-refusal')).toBeVisible({
        timeout: 20_000,
      });
      await other.window
        .getByRole('button', { name: 'Open as guest instead' })
        .click();

      await expect(other.window.locator('.ProseMirror')).toContainText(
        'Another document',
        { timeout: 20_000 }
      );
      await expect(other.window).toHaveTitle('v2 | world');
    } finally {
      await other.close();
      try {
        fs.rmSync(otherProjectDir, { recursive: true, force: true });
      } catch {}
    }
  });
});

// A guest is joined or gone: the flows around leaving.
test.describe('guest leaving and joining again', () => {
  let syncServer: Awaited<ReturnType<typeof startSyncServer>>;

  test.beforeEach(async ({ window }) => {
    syncServer = await startSyncServer();
    await pointAtSyncServer(window, syncServer.url);
  });

  test.afterEach(() => {
    syncServer.stop();
  });

  const joinFromProjectSelection = async (window: Page, shareId: string) => {
    await window
      .getByRole('button', { name: 'Join shared document' })
      .first()
      .click();
    const input = window.getByPlaceholder('Share ID');
    await input.fill(shareId);
    await input.press('Enter');
  };

  // The index page and the project selection screen offer the same button.
  const joinFromIndex = joinFromProjectSelection;

  const leave = async (window: Page) => {
    await window.getByRole('button', { name: 'Sharing Options' }).click();
    await window
      .getByRole('dialog')
      .getByRole('button', { name: 'Leave' })
      .click();
    await expect(
      window.getByRole('button', { name: 'Join shared document' }).first()
    ).toBeVisible({ timeout: 10_000 });
  };

  const stopSharing = async (window: Page) => {
    await window.getByRole('button', { name: 'Sharing Options' }).click();
    await window.getByRole('button', { name: 'Stop sharing' }).click();
    await window
      .getByRole('button', { name: 'Stop sharing' })
      .waitFor({ state: 'hidden', timeout: 10_000 });
  };

  test('after leaving one document a guest can join another', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const helloShareId = await shareCurrentDocument({ window });
    await window.getByText('world').click();
    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
    const worldShareId = await shareCurrentDocument({ window });

    const guest = await launchSecondApp();
    try {
      await pointAtSyncServer(guest.window, syncServer.url);
      const guestEditor = guest.window.locator('.ProseMirror');

      await joinFromProjectSelection(guest.window, helloShareId);
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await leave(guest.window);

      await joinFromIndex(guest.window, worldShareId);
      await expect(guestEditor).toContainText('Another document', {
        timeout: 20_000,
      });
      await expect(guest.window.getByTestId('guest-share')).toHaveCount(1);
      await expect(guest.window.getByTestId('guest-share')).toContainText(
        'world'
      );
    } finally {
      await guest.close();
    }
  });

  test('after leaving, a guest can join a new share of a document with the same name', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const firstShareId = await shareCurrentDocument({ window });

    const guest = await launchSecondApp();
    try {
      await pointAtSyncServer(guest.window, syncServer.url);
      const guestEditor = guest.window.locator('.ProseMirror');

      await joinFromProjectSelection(guest.window, firstShareId);
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await leave(guest.window);

      // The host shares the same document again: a new share, same name.
      await stopSharing(window);
      const secondShareId = await shareCurrentDocument({ window });
      expect(secondShareId).not.toBe(firstShareId);

      await joinFromIndex(guest.window, secondShareId);
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await expect(guest.window.getByTestId('guest-share')).toHaveCount(1);
    } finally {
      await guest.close();
    }
  });

  test('after leaving, a guest can join the same document again', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const shareId = await shareCurrentDocument({ window });

    const guest = await launchSecondApp();
    try {
      await pointAtSyncServer(guest.window, syncServer.url);
      const guestEditor = guest.window.locator('.ProseMirror');

      await joinFromProjectSelection(guest.window, shareId);
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await leave(guest.window);

      await joinFromIndex(guest.window, shareId);
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });

      // Still one document, and edits still flow.
      await typeInEditorSlowly({
        window: guest.window,
        text: ' again',
        delay: 30,
      });
      await expect(window.locator('.ProseMirror')).toContainText('again', {
        timeout: 20_000,
      });
    } finally {
      await guest.close();
    }
  });

  test('a guest switches between joined documents from the list', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const helloShareId = await shareCurrentDocument({ window });
    await window.getByText('world').click();
    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
    const worldShareId = await shareCurrentDocument({ window });

    const guest = await launchSecondApp();
    try {
      await pointAtSyncServer(guest.window, syncServer.url);
      const guestEditor = guest.window.locator('.ProseMirror');

      await joinFromProjectSelection(guest.window, helloShareId);
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });

      // Joining another while one is open, from the palette.
      await openCommandPalette({ window: guest.window });
      const joinOption = guest.window.getByRole('option', {
        name: 'Join shared document',
      });
      await joinOption.waitFor({ state: 'visible', timeout: 2_000 });
      await joinOption.click();
      const input = guest.window.getByPlaceholder('Share ID');
      await input.fill(worldShareId);
      await input.press('Enter');
      await expect(guestEditor).toContainText('Another document', {
        timeout: 20_000,
      });
      await expect(guest.window.getByTestId('guest-share')).toHaveCount(2);

      // Back to the first from the list.
      await guest.window
        .getByTestId('guest-share')
        .filter({ hasText: 'hello' })
        .click();
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
    } finally {
      await guest.close();
    }
  });
});

test.describe('guest and host in one app', () => {
  let syncServer: Awaited<ReturnType<typeof startSyncServer>>;

  test.beforeEach(async ({ window }) => {
    syncServer = await startSyncServer();
    await pointAtSyncServer(window, syncServer.url);
  });

  test.afterEach(() => {
    syncServer.stop();
  });

  test('joining your own share as a guest and leaving it does not break the host document', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const helloShareId = await shareCurrentDocument({ window });
    await window.getByText('world').click();
    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
    const worldShareId = await shareCurrentDocument({ window });

    // To the shared documents area from the project, then join own share.
    await openCommandPalette({ window });
    const areaOption = window.getByRole('option', { name: 'Shared with me' });
    await areaOption.waitFor({ state: 'visible', timeout: 2_000 });
    await areaOption.click();
    await window
      .getByRole('button', { name: 'Join shared document' })
      .first()
      .click();
    const input = window.getByPlaceholder('Share ID');
    await input.fill(helloShareId);
    await input.press('Enter');

    const editor = window.locator('.ProseMirror');
    await expect(editor).toContainText('This is a test document', {
      timeout: 20_000,
    });
    await expect(window).toHaveTitle('v2 | hello');

    // Leave it, then join the other share.
    await window.getByRole('button', { name: 'Sharing Options' }).click();
    await window
      .getByRole('dialog')
      .getByRole('button', { name: 'Leave' })
      .click();
    await window
      .getByRole('button', { name: 'Join shared document' })
      .first()
      .click();
    await window.getByPlaceholder('Share ID').fill(worldShareId);
    await window.getByPlaceholder('Share ID').press('Enter');
    await expect(editor).toContainText('Another document', { timeout: 20_000 });
  });
});

test.describe('guest leaving while the host stays', () => {
  let syncServer: Awaited<ReturnType<typeof startSyncServer>>;

  test.beforeEach(async ({ window }) => {
    syncServer = await startSyncServer();
    await pointAtSyncServer(window, syncServer.url);
  });

  test.afterEach(() => {
    syncServer.stop();
  });

  // The host keeps the left document open: its presence heartbeats and edits
  // keep arriving for a document this guest no longer holds.
  test('a guest can still join another document a while after leaving one', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(180_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const helloShareId = await shareCurrentDocument({ window });
    await window.getByText('world').click();
    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
    const worldShareId = await shareCurrentDocument({ window });
    // Back on the first document, where the host keeps working.
    await openHelloMd({ window });

    const guest = await launchSecondApp();
    try {
      await pointAtSyncServer(guest.window, syncServer.url);
      const guestEditor = guest.window.locator('.ProseMirror');
      const errors: string[] = [];
      guest.window.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      await guest.window
        .getByRole('button', { name: 'Join shared document' })
        .first()
        .click();
      await guest.window.getByPlaceholder('Share ID').fill(helloShareId);
      await guest.window.getByPlaceholder('Share ID').press('Enter');
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });

      await guest.window
        .getByRole('button', { name: 'Sharing Options' })
        .click();
      await guest.window
        .getByRole('dialog')
        .getByRole('button', { name: 'Leave' })
        .click();

      // The host goes on typing in the document the guest left, and enough
      // time passes for presence heartbeats to arrive too.
      await typeInEditorSlowly({ window, text: ' still here', delay: 30 });
      await guest.window.waitForTimeout(12_000);

      await guest.window
        .getByRole('button', { name: 'Join shared document' })
        .first()
        .click();
      await guest.window.getByPlaceholder('Share ID').fill(worldShareId);
      await guest.window.getByPlaceholder('Share ID').press('Enter');
      await expect(guestEditor).toContainText('Another document', {
        timeout: 20_000,
      });

      expect(errors).toEqual([]);
    } finally {
      await guest.close();
    }
  });
});

// Playwright cannot open a native menu, so the show handler answers with the
// given action straight away, as the explorer specs do.
const answerGuestShareMenuWith = async ({
  electronApp,
  type,
}: {
  electronApp: ElectronApplication;
  type: 'RENAME' | 'LEAVE';
}) => {
  await electronApp.evaluate(async ({ ipcMain, BrowserWindow }, actionType) => {
    ipcMain.removeHandler('context-menu:show');

    ipcMain.handle('context-menu:show', async (_, payload) => {
      if (payload.context !== 'GUEST_SHARE') return;

      BrowserWindow.getAllWindows()[0].webContents.send('context-menu:action', {
        context: 'GUEST_SHARE',
        action: { type: actionType, shareId: payload.shareId },
      });
    });
  }, type);
};

// Shares hello.md from the project, then opens that share as a guest in the
// same app, so the list holds one entry.
const openOwnShareAsGuest = async ({
  electronApp,
  window,
  testProjectDir,
}: {
  electronApp: ElectronApplication;
  window: Page;
  testProjectDir: string;
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });
  const shareId = await shareCurrentDocument({ window });

  await openCommandPalette({ window });
  const areaOption = window.getByRole('option', { name: 'Shared with me' });
  await areaOption.waitFor({ state: 'visible', timeout: 2_000 });
  await areaOption.click();
  await window
    .getByRole('button', { name: 'Join shared document' })
    .first()
    .click();
  const input = window.getByPlaceholder('Share ID');
  await input.fill(shareId);
  await input.press('Enter');

  await expect(window.locator('.ProseMirror')).toContainText(
    'This is a test document',
    { timeout: 20_000 }
  );
  await expect(window).toHaveTitle('v2 | hello');
};

test.describe('the list entry menu', () => {
  let syncServer: Awaited<ReturnType<typeof startSyncServer>>;

  test.beforeEach(async ({ window }) => {
    syncServer = await startSyncServer();
    await pointAtSyncServer(window, syncServer.url);
  });

  test.afterEach(() => {
    syncServer.stop();
  });

  test('leaving the open document from its entry', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openOwnShareAsGuest({ electronApp, window, testProjectDir });
    await answerGuestShareMenuWith({ electronApp, type: 'LEAVE' });

    await window.getByTestId('guest-share').click({ button: 'right' });

    await expect(window.getByText('Nothing shared with you yet.')).toBeVisible({
      timeout: 10_000,
    });
    await expectNoOpenDocument({ window });
  });

  test('giving an entry a name of its own', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    test.setTimeout(120_000);

    await openOwnShareAsGuest({ electronApp, window, testProjectDir });
    await answerGuestShareMenuWith({ electronApp, type: 'RENAME' });

    await window.getByTestId('guest-share').click({ button: 'right' });
    const field = window.getByLabel('Shared document name');
    await expect(field).toHaveValue('hello');
    await field.fill('My notes');
    await field.press('Enter');

    await expect(window.getByTestId('guest-share')).toContainText('My notes');
    // The open document is called by the name given here.
    await expect(window).toHaveTitle('v2 | My notes');
    await expect(window.locator('.ProseMirror')).toContainText(
      'This is a test document'
    );
  });
});
