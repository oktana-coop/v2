import path from 'path';

import { expect, test } from './fixtures';
import { createNewFile, openHelloMd, openProjectFolder } from './helpers';

test('create new file via UI: appears in explorer and is editable', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder(electronApp, window, testProjectDir);

  // Mock showSaveDialog so we control the filename, then click create-file-button
  const newFilePath = path.join(testProjectDir, 'my-new-doc.md');
  await createNewFile(electronApp, window, newFilePath);

  // The new file should appear in the explorer sidebar
  await expect(window.getByTestId('file-explorer')).toContainText('my-new-doc');

  // The editor should be open and editable
  const editor = window.locator('.ProseMirror');
  await editor.click();
  await window.keyboard.type('Hello new doc');
  await expect(editor).toContainText('Hello new doc');
});

test('document switching: content is preserved', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  const editor = window.locator('.ProseMirror');
  await editor.click();
  await window.keyboard.press('End');
  await window.keyboard.type(' hello edit');

  // Wait for the 300 ms auto-save debounce to flush before navigating away
  await window.waitForTimeout(500);

  // Switch to world.md
  await window.getByText('world').click();

  // Editor should now show world.md content
  await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
    'World'
  );

  // Switch back to hello.md
  await window.getByText('hello').click();

  // The unsaved edit should still be there
  await expect(window.locator('.ProseMirror')).toContainText('hello edit');
});

test('empty project: shows empty state when directory has no files', async ({
  electronApp,
  window,
  emptyProjectDir,
}) => {
  await openProjectFolder(electronApp, window, emptyProjectDir);

  const explorer = window.getByTestId('file-explorer');
  await expect(explorer).toBeVisible();

  // EmptyView renders when the directory has no documents
  await expect(explorer).toContainText('no documents');
});
