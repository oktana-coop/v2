import { expect, test } from '../shared/fixtures';
import {
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import {
  closeShareDialog,
  expectPrivate,
  expectShared,
  shareButton,
  shareFromActionsBar,
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
    await typeInEditorSlowly({ window, text: ' one', delay: 30 });

    const first = await shareFromActionsBar({ window });
    await expectShared({ window });
    await typeInEditorSlowly({ window, text: ' two', delay: 30 });

    await stopSharingFromActionsBar({ window });
    await expectPrivate({ window });
    await typeInEditorSlowly({ window, text: ' three', delay: 30 });

    const second = await shareFromActionsBar({ window });
    await expectShared({ window });
    expect(second).not.toBe(first);
    await typeInEditorSlowly({ window, text: ' four', delay: 30 });

    await stopSharingFromActionsBar({ window });
    await expectPrivate({ window });

    const editor = window.locator('.ProseMirror');
    await expect(editor).toContainText('one two three four');
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
