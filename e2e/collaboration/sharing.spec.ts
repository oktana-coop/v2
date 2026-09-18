import { type Page } from '@playwright/test';

import { expect, test } from '../shared/fixtures';
import {
  openHelloMd,
  openProjectFolder,
  typeInEditorSlowly,
} from '../shared/helpers';
import { startSyncServer } from '../shared/sync-server';

// The share button in the editor's actions bar: it reads as "Share Document"
// while the document is private and "Sharing Options" once it is shared.
const shareButton = (window: Page) =>
  window.getByRole('button', { name: /Share Document|Sharing Options/ });

const expectPrivate = async (window: Page) => {
  await expect(
    window.getByRole('button', { name: 'Share Document' })
  ).toBeVisible();
};

const expectShared = async (window: Page) => {
  await expect(
    window.getByRole('button', { name: 'Sharing Options' })
  ).toBeVisible();
};

const closeShareDialog = async (window: Page) => {
  const close = window.getByRole('button', { name: 'Close' });
  await close.click();
  await close.waitFor({ state: 'hidden', timeout: 5_000 });
};

const shareFromButton = async (window: Page): Promise<string> => {
  await shareButton(window).click();
  await window.getByRole('button', { name: 'Create share ID' }).click();

  const shareId = window.getByTestId('share-id');
  await shareId.waitFor({ state: 'visible', timeout: 10_000 });
  const shareUrl = await shareId.textContent();
  expect(shareUrl).toMatch(/^automerge:/);

  await closeShareDialog(window);

  return shareUrl as string;
};

const stopSharingFromButton = async (window: Page) => {
  await shareButton(window).click();
  await window.getByRole('button', { name: 'Stop sharing' }).click();
  await window
    .getByRole('button', { name: 'Stop sharing' })
    .waitFor({ state: 'hidden', timeout: 10_000 });
};

test.describe('sharing from the actions bar', () => {
  let syncServer: Awaited<ReturnType<typeof startSyncServer>>;

  test.beforeEach(async ({ window }) => {
    syncServer = await startSyncServer();
    await window.evaluate((url) => {
      localStorage.setItem('syncServiceUrl', url);
    }, syncServer.url);
  });

  test.afterEach(() => {
    syncServer.stop();
  });

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

    await expectPrivate(window);
    await shareFromButton(window);
    await expectShared(window);
    await stopSharingFromButton(window);
    await expectPrivate(window);
  });

  test('sharing options reopen with the same share ID', async ({
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

    const shareUrl = await shareFromButton(window);

    await shareButton(window).click();
    await expect(window.getByTestId('share-id')).toHaveText(shareUrl);
    await closeShareDialog(window);
    await expectShared(window);
  });

  test('share, stop, share, stop keeps working and keeps the text', async ({
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

    const first = await shareFromButton(window);
    await expectShared(window);
    await typeInEditorSlowly({ window, text: ' two', delay: 30 });

    await stopSharingFromButton(window);
    await expectPrivate(window);
    await typeInEditorSlowly({ window, text: ' three', delay: 30 });

    const second = await shareFromButton(window);
    await expectShared(window);
    expect(second).not.toBe(first);
    await typeInEditorSlowly({ window, text: ' four', delay: 30 });

    await stopSharingFromButton(window);
    await expectPrivate(window);

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
