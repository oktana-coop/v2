import { Page } from '@playwright/test';

import { expect, test } from '../shared/fixtures';
import {
  clearClipboard,
  focusParagraph,
  openCommandPalette,
  openHelloMd,
  openProjectFolder,
  readClipboardText,
  runPaletteAction,
} from '../shared/helpers';

/**
 * Selects the body paragraph ("This is a test document.") of hello.md.
 *
 * The editor can remount shortly after a document opens (sync/save cycles),
 * which resets the selection — so re-select until the selection sticks.
 */
const selectHelloMdParagraph = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await expect
    .poll(
      async () => {
        await focusParagraph({ window });
        await window.keyboard.press('Home');
        await window.keyboard.press('Shift+End');

        // Give a pending editor remount the chance to wipe the selection, so
        // we only proceed with a selection that has settled.
        await window.waitForTimeout(300);
        return window.evaluate(() => document.getSelection()?.toString());
      },
      { timeout: 15_000 }
    )
    .toBe('This is a test document.');
};

test.describe('copy selection as markdown', () => {
  test('copies only the selection as Markdown to the clipboard', async ({
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

    // Select the body paragraph but not the title
    await selectHelloMdParagraph({ window });

    await clearClipboard({ electronApp });

    await runPaletteAction({
      window,
      actionName: 'Copy selection as Markdown',
    });

    // The success notification confirms the clipboard write completed
    await expect(window.getByText('Copied to Clipboard')).toBeVisible({
      timeout: 10_000,
    });

    const clipboardText = await readClipboardText({ electronApp });
    expect(clipboardText).toContain('This is a test document.');
    // The heading was not part of the selection, so it must not be copied
    expect(clipboardText).not.toContain('Hello');
  });

  test('does not offer the selection action when nothing is selected', async ({
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

    await openCommandPalette({ window });

    await expect(
      window.getByRole('option', { name: 'Copy as Markdown', exact: true })
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      window.getByRole('option', {
        name: 'Copy selection as Markdown',
        exact: true,
      })
    ).toBeHidden();
  });
});
