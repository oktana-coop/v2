import path from 'path';

import { expect, test } from './fixtures';
import {
  createNewFile,
  openHelloMd,
  openProjectFolder,
  typeInEditorAndWaitForDebounce,
} from './helpers';

test('create new file via UI: appears in explorer and is editable', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });

  // Mock showSaveDialog so we control the filename, then click create-file-button
  const newFilePath = path.join(testProjectDir, 'my-new-doc.md');
  await createNewFile({ electronApp, window, filePath: newFilePath });

  // The new file should appear in the explorer sidebar
  await expect(window.getByTestId('file-explorer')).toContainText('my-new-doc');

  // The editor should be open and editable
  await typeInEditorAndWaitForDebounce({ window, text: 'Hello new doc' });
  await expect(window.locator('.ProseMirror')).toContainText('Hello new doc');
});

test('document switching: content is preserved', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' hello edit' });

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
  await openProjectFolder({ electronApp, window, folderPath: emptyProjectDir });

  const explorer = window.getByTestId('file-explorer');
  await expect(explorer).toBeVisible();

  // EmptyView renders when the directory has no documents
  await expect(explorer).toContainText('no documents');
});
