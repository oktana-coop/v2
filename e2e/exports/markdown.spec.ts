import { expect, test } from '../shared/fixtures';
import {
  clearClipboard,
  openHelloMd,
  openProjectFolder,
  readClipboardText,
  runPaletteAction,
} from '../shared/helpers';

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
