import { ElectronApplication, Page } from '@playwright/test';

import { expect, test } from '../shared/fixtures';
import {
  openCommandPalette,
  openHelloMd,
  openProjectFolder,
} from '../shared/helpers';

const readClipboardText = async ({
  electronApp,
}: {
  electronApp: ElectronApplication;
}): Promise<string> =>
  electronApp.evaluate(({ clipboard }) => clipboard.readText());

const clearClipboard = async ({
  electronApp,
}: {
  electronApp: ElectronApplication;
}): Promise<void> => electronApp.evaluate(({ clipboard }) => clipboard.clear());

const runPaletteAction = async ({
  window,
  actionName,
}: {
  window: Page;
  actionName: string;
}): Promise<void> => {
  await openCommandPalette({ window });

  const option = window.getByRole('option', { name: actionName, exact: true });
  await option.waitFor({ state: 'visible', timeout: 5_000 });
  await option.click();
};

test.describe('copy as markdown', () => {
  test('copies the whole document as Markdown to the clipboard', async ({
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
    await clearClipboard({ electronApp });

    await runPaletteAction({ window, actionName: 'Copy as Markdown' });

    // The success notification confirms the clipboard write completed
    await expect(window.getByText('Copied to Clipboard')).toBeVisible({
      timeout: 10_000,
    });

    const clipboardText = await readClipboardText({ electronApp });
    expect(clipboardText).toContain('# Hello');
    expect(clipboardText).toContain('This is a test document.');
  });
});
