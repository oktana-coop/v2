import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  createNewFile,
  openHelloMd,
  openProjectFolder,
  typeInEditor,
  typeInEditorAndWaitForDebounce,
} from '../shared/helpers';

test.describe('empty project', () => {
  test('shows empty state when directory has no files', async ({
    electronApp,
    window,
    emptyProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: emptyProjectDir,
    });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer).toBeVisible();

    // EmptyView renders when the directory has no documents
    await expect(explorer).toContainText('no documents');
  });
});

test.describe('flat directory structure', () => {
  test('opens a project folder and lists documents', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    // Both .md files should appear in the sidebar
    await expect(window.getByText('hello')).toBeVisible();
    await expect(window.getByText('world')).toBeVisible();

    await window.screenshot({
      path: 'e2e-results/screenshots/project-open.png',
    });
  });

  test('opens a document and edits it in the editor', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    // Click the first document in the sidebar
    await window.getByText('hello').click();

    // ProseMirror editor root (.ProseMirror) should be visible and contain initial content
    const editor = window.locator('.ProseMirror');
    await expect(editor).toBeVisible();
    await expect(editor.locator('h1')).toHaveText('Hello');

    // Type some new content
    await typeInEditor({ window, text: ' — edited' });

    // Verify the DOM reflects the edit
    await expect(editor).toContainText('Hello — edited');

    await window.screenshot({
      path: 'e2e-results/screenshots/editor-edit.png',
    });
  });

  test('create new file via UI: appears in explorer and is editable', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    // Mock showSaveDialog so we control the filename, then click create-file-button
    const newFilePath = path.join(testProjectDir, 'my-new-doc.md');
    await createNewFile({ electronApp, window, filePath: newFilePath });

    // The new file should appear in the explorer sidebar
    await expect(window.getByTestId('file-explorer')).toContainText(
      'my-new-doc'
    );

    // The editor should be open and editable
    await typeInEditorAndWaitForDebounce({ window, text: 'Hello new doc' });
    await expect(window.locator('.ProseMirror')).toContainText('Hello new doc');
  });

  test('document switching: content is preserved', async ({
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
});

test.describe('nested directory structure', () => {
  test('subdirectories appear in the file explorer tree', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer).toBeVisible();

    await expect(explorer.getByText('alpha-folder')).toBeVisible();
    await expect(explorer.getByText('notes')).toBeVisible();
    await expect(explorer.getByText('beta-folder')).toBeVisible();
  });

  test('clicking a file inside a subdirectory opens it in the editor', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // react-arborist opens all nodes by default; the nested file is immediately
    // visible without having to expand the parent directory first
    await window.getByText('nested-note.md').click();
    await window.waitForSelector('.ProseMirror', { timeout: 300 });

    const editor = window.locator('.ProseMirror');
    await expect(editor.locator('h1')).toHaveText('Nested Note');
  });

  test('collapsing a directory hides its children', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // All nodes start expanded; alpha-folder's children are visible
    await expect(window.getByText('notes')).toBeVisible();
    await expect(window.getByText('nested-note.md')).toBeVisible();

    // Click alpha-folder to collapse it
    await window.getByText('alpha-folder').click();

    // Both the immediate child (notes) and its descendant should disappear
    await expect(window.getByText('notes')).not.toBeVisible();
    await expect(window.getByText('nested-note.md')).not.toBeVisible();
  });

  test('expanding a collapsed directory reveals its children', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // Collapse alpha-folder, then expand it again
    await window.getByText('alpha-folder').click();
    await expect(window.getByText('notes')).not.toBeVisible();

    await window.getByText('alpha-folder').click();
    await expect(window.getByText('notes')).toBeVisible();
    await expect(window.getByText('nested-note.md')).toBeVisible();
  });

  test('tree is sorted with directories first then files, each group alphabetically', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // With all nodes expanded the rendered order (top-to-bottom) is:
    //   alpha-folder → notes → nested-note.md → beta-folder → beta-doc.md → armadillo.md → zebra.md
    // We compare DOM indices to verify the sort contract.
    const labels = await window.locator('[role="treeitem"]').allTextContents();
    const idx = (text: string) => labels.findIndex((l) => l.includes(text));

    // Both directories must appear before all root-level files
    expect(idx('alpha-folder')).toBeLessThan(idx('armadillo.md'));
    expect(idx('beta-folder')).toBeLessThan(idx('armadillo.md'));

    // Directories are sorted alphabetically among themselves
    expect(idx('alpha-folder')).toBeLessThan(idx('beta-folder'));

    // Files are sorted alphabetically among themselves
    expect(idx('armadillo.md')).toBeLessThan(idx('zebra.md'));
  });
});
