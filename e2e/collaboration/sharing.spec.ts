import { expect, test } from '../shared/fixtures';
import {
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import { startTcpListener } from '../shared/sync-server';
import {
  closeShareDialog,
  expectPrivate,
  expectShared,
  joinFromButton,
  launchApp,
  shareButton,
  shareFromActionsBar,
  shareFromCommandPalette,
  stopSharingFromActionsBar,
} from './helpers';

test.describe('sharing from the actions bar', () => {
  test.use({ withSyncServer: true });

  test('the button reflects the sharing state', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await expectPrivate({ window });
    await shareFromActionsBar({ window });
    await expectShared({ window });
    // The explorer marks the shared document.
    await expect(window.getByTestId('shared-document-badge')).toBeVisible();
    await stopSharingFromActionsBar({ window });
    await expect(window.getByTestId('shared-document-badge')).toHaveCount(0);
    await expectPrivate({ window });
  });

  test('reopening the sharing options shows the existing share ID', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    const shareId = await shareFromActionsBar({ window });

    await shareButton(window).click();
    await expect(window.getByTestId('share-id')).toHaveText(shareId);
    await closeShareDialog({ window });
    await expectShared({ window });
  });

  test('sharing again after stopping gives a new share ID and keeps the text', async ({
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
    await typeInEditorSlowly({ window, text: ' mercury', delay: 30 });

    const first = await shareFromActionsBar({ window });
    await expectShared({ window });
    await typeInEditorSlowly({ window, text: ' venus', delay: 30 });

    await stopSharingFromActionsBar({ window });
    await expectPrivate({ window });
    await typeInEditorSlowly({ window, text: ' earth', delay: 30 });

    const second = await shareFromActionsBar({ window });
    await expectShared({ window });
    expect(second).not.toBe(first);
    await typeInEditorSlowly({ window, text: ' mars', delay: 30 });

    await stopSharingFromActionsBar({ window });
    await expectPrivate({ window });

    const editor = window.locator('.ProseMirror');
    await expect(editor).toContainText('mercury venus earth mars');
  });

  test('the dialog can be reopened after being dismissed with Escape', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await shareButton(window).click();
    const create = window.getByRole('button', { name: 'Create share ID' });
    await expect(create).toBeVisible();
    await window.keyboard.press('Escape');
    await create.waitFor({ state: 'hidden', timeout: 5_000 });

    await shareButton(window).click();
    await expect(create).toBeVisible();
  });
});

test.describe('a document before and while sharing', () => {
  test.use({ withSyncServer: true });

  // Private documents live in a repo with no network: nothing dials the
  // sync service until a document is shared or joined.
  test('a private document never dials the sync service', async () => {
    const syncService = await startTcpListener();

    const alice = await launchApp({ syncServiceUrl: syncService.url });
    try {
      await openProjectFolder({
        electronApp: alice.app,
        window: alice.window,
        folderPath: alice.projectDir,
      });
      await openHelloMd({ window: alice.window });
      await typeInEditorSlowly({
        window: alice.window,
        text: ' kept local',
        delay: 30,
      });

      await syncService.expectNoConnectionsAfterWaiting();
    } finally {
      await alice.close();
      syncService.stop();
    }
  });

  // Sharing switches the open document in place: nothing re-opens, so text
  // typed before, during, and after the transition all survives.
  test('typing through the share transition loses nothing', async ({
    syncServer,
    electronApp,
    window: aliceWindow,
    testProjectDir: aliceProject,
  }) => {
    test.setTimeout(120_000);

    await openProjectFolder({
      electronApp,
      window: aliceWindow,
      folderPath: aliceProject,
    });
    await openHelloMd({ window: aliceWindow });

    await typeInEditorSlowly({
      window: aliceWindow,
      text: ' before',
      delay: 30,
    });

    const shareId = await shareFromCommandPalette({ window: aliceWindow });

    await typeInEditorSlowly({
      window: aliceWindow,
      text: ' after',
      delay: 30,
    });

    const editor = aliceWindow.locator('.ProseMirror');
    await expect(editor).toContainText('before after');
    await syncServer!.waitForShare(shareId);

    // Someone joining sees everything, including what was typed before the share.
    const bob = await launchApp({ syncServiceUrl: syncServer!.url });
    try {
      await joinFromButton({ window: bob.window, shareId });
      await expect(bob.window.locator('.ProseMirror')).toContainText(
        'before after',
        { timeout: 20_000 }
      );
    } finally {
      await bob.close();
    }
  });
});
