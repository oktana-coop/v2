import { type ElectronApplication, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  expectNoErrorNotification,
  expectNoOpenDocument,
  openCommandPalette,
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import {
  attemptJoinFromCommandPalette,
  expectPeerAvatars,
  guestShares,
  joinFromButton,
  joinFromCommandPalette,
  launchApp,
  leaveFromActionsBar,
  shareFromCommandPalette,
  stopSharingFromActionsBar,
} from './helpers';

test.use({ withSyncServer: true });

test.describe('guest editing', () => {
  test('a guest joins from the project selection screen, edits with the host, and leaves', async ({
    electronApp,
    window,
    testProjectDir,
    syncServer,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const shareId = await shareFromCommandPalette({ window });

    const guest = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      // No project open: the project selection screen offers to join.
      await joinFromButton({ window: guest.window, shareId });

      const guestEditor = guest.window.locator('.ProseMirror');
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await expect(guest.window).toHaveTitle('v2 | hello');
      // Listed under the name the share carries.
      const listed = guestShares(guest.window);
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
      await expectPeerAvatars({ window, count: 1 });
      await expectPeerAvatars({ window: guest.window, count: 1 });

      // Leaving returns to the list, which no longer holds the share.
      await leaveFromActionsBar({ window: guest.window });
      await expect(guestShares(guest.window)).toHaveCount(0);
    } finally {
      await guest.close();
    }
  });

  test('a share this project cannot take up is offered as a guest', async ({
    electronApp,
    window,
    testProjectDir,
    syncServer,
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
    const shareId = await shareFromCommandPalette({ window });

    const other = await launchApp({ syncServiceUrl: syncServer!.url });
    const otherProjectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v2-e2e-other-')
    );
    fs.writeFileSync(
      path.join(otherProjectDir, 'hello.md'),
      '# Hello\n\nAnother project.\n'
    );
    try {
      await openProjectFolder({
        electronApp: other.app,
        window: other.window,
        folderPath: otherProjectDir,
      });
      await openHelloMd({ window: other.window });

      await attemptJoinFromCommandPalette({ window: other.window, shareId });

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
  test('after leaving one document a guest can join another', async ({
    electronApp,
    window,
    testProjectDir,
    syncServer,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const helloShareId = await shareFromCommandPalette({ window });
    await window.getByText('world').click();
    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
    const worldShareId = await shareFromCommandPalette({ window });

    const guest = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      const guestEditor = guest.window.locator('.ProseMirror');

      await joinFromButton({ window: guest.window, shareId: helloShareId });
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await leaveFromActionsBar({ window: guest.window });

      await joinFromButton({ window: guest.window, shareId: worldShareId });
      await expect(guestEditor).toContainText('Another document', {
        timeout: 20_000,
      });
      await expect(guestShares(guest.window)).toHaveCount(1);
      await expect(guestShares(guest.window)).toContainText('world');
    } finally {
      await guest.close();
    }
  });

  test('after leaving, a guest can join a new share of a document with the same name', async ({
    electronApp,
    window,
    testProjectDir,
    syncServer,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const firstShareId = await shareFromCommandPalette({ window });

    const guest = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      const guestEditor = guest.window.locator('.ProseMirror');

      await joinFromButton({ window: guest.window, shareId: firstShareId });
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await leaveFromActionsBar({ window: guest.window });

      // The host shares the same document again: a new share, same name.
      await stopSharingFromActionsBar({ window });
      const secondShareId = await shareFromCommandPalette({ window });
      expect(secondShareId).not.toBe(firstShareId);

      await joinFromButton({ window: guest.window, shareId: secondShareId });
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await expect(guestShares(guest.window)).toHaveCount(1);
    } finally {
      await guest.close();
    }
  });

  test('after leaving, a guest can join the same document again', async ({
    electronApp,
    window,
    testProjectDir,
    syncServer,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const shareId = await shareFromCommandPalette({ window });

    const guest = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      const guestEditor = guest.window.locator('.ProseMirror');

      await joinFromButton({ window: guest.window, shareId });
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await leaveFromActionsBar({ window: guest.window });

      await joinFromButton({ window: guest.window, shareId });
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
    syncServer,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    const helloShareId = await shareFromCommandPalette({ window });
    await window.getByText('world').click();
    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
    const worldShareId = await shareFromCommandPalette({ window });

    const guest = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      const guestEditor = guest.window.locator('.ProseMirror');

      await joinFromButton({ window: guest.window, shareId: helloShareId });
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });

      // Joining another while one is open, from the palette.
      await joinFromCommandPalette({
        window: guest.window,
        shareId: worldShareId,
      });
      await expect(guestEditor).toContainText('Another document', {
        timeout: 20_000,
      });
      await expect(guestShares(guest.window)).toHaveCount(2);

      // Back to the first from the list.
      await guestShares(guest.window).filter({ hasText: 'hello' }).click();
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
    } finally {
      await guest.close();
    }
  });
});

test.describe('guest and host in one app', () => {
  // TODO: refuse joining your own share as a guest, and turn this test into
  // checking that refusal.
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
    const helloShareId = await shareFromCommandPalette({ window });
    await window.getByText('world').click();
    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
    const worldShareId = await shareFromCommandPalette({ window });

    // To the shared documents area from the project, then join own share.
    await openCommandPalette({ window });
    const areaOption = window.getByRole('option', { name: 'Shared with me' });
    await areaOption.waitFor({ state: 'visible', timeout: 2_000 });
    await areaOption.click();
    await joinFromButton({ window, shareId: helloShareId });

    const editor = window.locator('.ProseMirror');
    await expect(editor).toContainText('This is a test document', {
      timeout: 20_000,
    });
    await expect(window).toHaveTitle('v2 | hello');

    // Leave it, then join the other share.
    await leaveFromActionsBar({ window });
    await joinFromButton({ window, shareId: worldShareId });
    await expect(editor).toContainText('Another document', { timeout: 20_000 });
  });
});

test.describe('guest leaving while the host stays', () => {
  test('a guest can join another document after leaving one the host is still editing', async ({
    electronApp,
    window: hostWindow,
    testProjectDir,
    syncServer,
  }) => {
    test.setTimeout(180_000);

    // The host shares hello and world, then stays on hello.
    await openProjectFolder({
      electronApp,
      window: hostWindow,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window: hostWindow });
    const helloShareId = await shareFromCommandPalette({ window: hostWindow });
    await hostWindow.getByText('world').click();
    await hostWindow.waitForSelector('.ProseMirror', { timeout: 3_000 });
    const worldShareId = await shareFromCommandPalette({ window: hostWindow });
    await openHelloMd({ window: hostWindow });

    const guest = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      const guestEditor = guest.window.locator('.ProseMirror');

      // The guest joins hello, then leaves it.
      await joinFromButton({ window: guest.window, shareId: helloShareId });
      await expect(guestEditor).toContainText('This is a test document', {
        timeout: 20_000,
      });
      await leaveFromActionsBar({ window: guest.window });

      // The host keeps typing in hello. The sync server keeps sending those
      // updates to the guest, who left but is still connected.
      // TODO: once leaving really leaves, check that the host's edits no longer
      // reach the guest (see leaveSharedDocument).
      await typeInEditorSlowly({
        window: hostWindow,
        text: ' still here',
        delay: 30,
      });
      await guest.window.waitForTimeout(12_000);

      // The guest joins world ("Another document") without errors from hello's
      // updates.
      await joinFromButton({ window: guest.window, shareId: worldShareId });
      await expect(guestEditor).toContainText('Another document', {
        timeout: 20_000,
      });
      await expectNoErrorNotification({ window: guest.window });
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

// Shares hello.md from the project, then has a second app join that share as a
// guest, so the guest's list holds one entry.
const shareWithGuest = async ({
  electronApp,
  window,
  testProjectDir,
  syncServiceUrl,
}: {
  electronApp: ElectronApplication;
  window: Page;
  testProjectDir: string;
  syncServiceUrl: string;
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });
  const shareId = await shareFromCommandPalette({ window });

  const guest = await launchApp({ syncServiceUrl });
  try {
    await joinFromButton({ window: guest.window, shareId });
    await expect(guest.window.locator('.ProseMirror')).toContainText(
      'This is a test document',
      { timeout: 20_000 }
    );
    await expect(guest.window).toHaveTitle('v2 | hello');
  } catch (error) {
    await guest.close();
    throw error;
  }

  return guest;
};

test.describe('the list entry menu', () => {
  test('leaving the open document from its entry', async ({
    electronApp,
    window,
    testProjectDir,
    syncServer,
  }) => {
    test.setTimeout(120_000);

    const guest = await shareWithGuest({
      electronApp,
      window,
      testProjectDir,
      syncServiceUrl: syncServer!.url,
    });
    try {
      await answerGuestShareMenuWith({
        electronApp: guest.app,
        type: 'LEAVE',
      });

      await guestShares(guest.window).click({ button: 'right' });

      await expect(
        guest.window.getByText('Nothing shared with you yet.')
      ).toBeVisible({ timeout: 10_000 });
      await expectNoOpenDocument({ window: guest.window });
    } finally {
      await guest.close();
    }
  });

  test('giving an entry a name of its own', async ({
    electronApp,
    window,
    testProjectDir,
    syncServer,
  }) => {
    test.setTimeout(120_000);

    const guest = await shareWithGuest({
      electronApp,
      window,
      testProjectDir,
      syncServiceUrl: syncServer!.url,
    });
    try {
      await answerGuestShareMenuWith({
        electronApp: guest.app,
        type: 'RENAME',
      });

      await guestShares(guest.window).click({ button: 'right' });
      const field = guest.window.getByLabel('Shared document name');
      await expect(field).toHaveValue('hello');
      await field.fill('My notes');
      await field.press('Enter');

      await expect(guestShares(guest.window)).toContainText('My notes');
      // The open document is called by the name given here.
      await expect(guest.window).toHaveTitle('v2 | My notes');
      await expect(guest.window.locator('.ProseMirror')).toContainText(
        'This is a test document'
      );
    } finally {
      await guest.close();
    }
  });
});
