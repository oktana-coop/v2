import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  confirmDeletion,
  createNewFileFromButton,
  createNewFileFromContextMenu,
  createNewSubfolderFromContextMenu,
  deleteFileFromContextMenu,
  deleteFolderFromContextMenu,
  deleteKey,
  mockCreateNewFile,
  newFileKey,
  openHelloMd,
  openProjectFolder,
  renameFileFromContextMenu,
  renameFolderFromContextMenu,
  renameKey,
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
    await createNewFileFromButton({
      electronApp,
      window,
      filePath: newFilePath,
    });

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

  test('create a new file via keyboard shortcut with no tree focus', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    await mockCreateNewFile({
      electronApp,
      filePath: path.join(testProjectDir, 'root-new.md'),
    });

    await window.keyboard.press(newFileKey);

    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer).toContainText('root-new');
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
    await window.waitForSelector('.ProseMirror', { timeout: 2_000 });

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

    await window.waitForTimeout(500);

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

  test('create new subfolder inside a directory via context menu', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await createNewSubfolderFromContextMenu({ electronApp });

    // Right-click the beta-folder directory node to trigger the NEW_DIRECTORY action
    await window.getByText('beta-folder').click({ button: 'right' });

    // An inline text input should appear for naming the new folder
    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    // Type the new folder name and confirm
    await input.fill('my-new-subfolder');
    await window.keyboard.press('Enter');

    // The new folder should appear in the explorer
    const explorer = window.getByTestId('file-explorer');
    await expect(explorer).toContainText('my-new-subfolder', {
      timeout: 500,
    });
  });

  test('inline input stays visible while typing a subfolder name', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await createNewSubfolderFromContextMenu({ electronApp });

    await window.getByText('beta-folder').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    // Type each character individually with a small delay to expose any
    // blur/focus race that dismisses the input mid-typing.
    for (const char of 'slow-typed-folder') {
      await window.keyboard.type(char);
      await window.waitForTimeout(30);
      await expect(input).toBeVisible();
    }

    await window.keyboard.press('Enter');

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer).toContainText('slow-typed-folder', {
      timeout: 500,
    });
  });

  test('create new file inside a subdirectory via context menu', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    const betaFolder = path.join(nestedProjectDir, 'beta-folder');
    const newFilePath = path.join(betaFolder, 'new-in-beta.md');

    await createNewFileFromContextMenu({
      electronApp,
      newFilePath,
    });

    // Right-click the beta-folder directory node to trigger context menu IPC
    await window.getByText('beta-folder').click({ button: 'right' });

    // Wait for the editor to open for the new file
    await window.waitForSelector('.ProseMirror', { timeout: 2_000 });

    // The new file should appear under beta-folder in the explorer
    const explorer = window.getByTestId('file-explorer');
    await expect(explorer).toContainText('new-in-beta');

    // The editor should be open and editable
    await typeInEditorAndWaitForDebounce({
      window,
      text: 'Created in subfolder',
    });
    await expect(window.locator('.ProseMirror')).toContainText(
      'Created in subfolder'
    );
  });

  test('create a new file via keyboard shortcut on a directory', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await mockCreateNewFile({
      electronApp,
      filePath: path.join(nestedProjectDir, 'beta-folder', 'shortcut-new.md'),
    });

    // Click a directory to focus it in the tree
    await window.getByText('beta-folder').click();

    await window.keyboard.press(newFileKey);

    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer).toContainText('shortcut-new');
  });

  test('create a new file via keyboard shortcut on a file', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // File is inside beta-folder; shortcut should create under the parent directory
    await mockCreateNewFile({
      electronApp,
      filePath: path.join(nestedProjectDir, 'beta-folder', 'sibling-new.md'),
    });

    // Click a file inside a subdirectory to focus it
    await window.getByText('beta-doc.md').click();
    await window.waitForSelector('.ProseMirror', { timeout: 2_000 });

    await window.keyboard.press(newFileKey);

    await window.waitForSelector('.ProseMirror', { timeout: 3_000 });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer).toContainText('sibling-new');
  });
});

test.describe('file deletion', () => {
  test('delete a file in project root', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    await deleteFileFromContextMenu({ electronApp });

    // Right-click hello to trigger the DELETE action
    await window.getByText('hello').click({ button: 'right' });

    await confirmDeletion({ window });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('hello')).not.toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('world')).toBeVisible();
  });

  test('delete a file within a sub-folder', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await deleteFileFromContextMenu({ electronApp });

    await window.getByText('beta-doc.md').click({ button: 'right' });

    await confirmDeletion({ window });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('beta-doc.md')).not.toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('beta-folder')).toBeVisible();
  });

  test('delete the currently-open file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    // Open hello.md in the editor
    await openHelloMd({ window });
    await expect(window.locator('.ProseMirror')).toBeVisible();

    await deleteFileFromContextMenu({ electronApp });

    const explorer = window.getByTestId('file-explorer');
    await explorer.getByText('hello').click({ button: 'right' });

    await confirmDeletion({ window });

    await expect(explorer.getByText('hello')).not.toBeVisible({
      timeout: 2_000,
    });
  });

  // TODO: Test that deletion creates a VCS commit once we have a
  // project-commits view that can be asserted against in the UI.
  test('delete a file via keyboard shortcut', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // Click the file to focus it in the tree
    await window.getByText('armadillo.md').click();

    // Press the platform-appropriate delete shortcut
    await window.keyboard.press(deleteKey);

    await confirmDeletion({ window });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('armadillo.md')).not.toBeVisible({
      timeout: 2_000,
    });
    // Other files should remain
    await expect(explorer.getByText('zebra.md')).toBeVisible();
  });

  test('cancel deletion keeps the file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    await deleteFileFromContextMenu({ electronApp });

    await window.getByText('hello').click({ button: 'right' });

    // Click Cancel instead of Delete
    const cancelBtn = window.getByRole('button', { name: /^Cancel$/i });
    await cancelBtn.waitFor({ state: 'visible', timeout: 500 });
    await cancelBtn.click();

    // File should still be visible
    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('hello')).toBeVisible();
  });
});

test.describe('folder deletion', () => {
  test('delete a folder in project root', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await deleteFolderFromContextMenu({ electronApp });

    await window.getByText('beta-folder').click({ button: 'right' });

    await confirmDeletion({ window });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('beta-folder')).not.toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('beta-doc.md')).not.toBeVisible({
      timeout: 2_000,
    });
    // Other folders/files should remain
    await expect(explorer.getByText('alpha-folder')).toBeVisible();
  });

  test('delete a nested folder', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await deleteFolderFromContextMenu({ electronApp });

    await window.getByText('notes').click({ button: 'right' });

    await confirmDeletion({ window });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('notes')).not.toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('nested-note.md')).not.toBeVisible({
      timeout: 2_000,
    });
    // Parent folder should still exist
    await expect(explorer.getByText('alpha-folder')).toBeVisible();
  });

  test('delete folder containing the currently-opened file', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // Open nested-note.md which lives inside alpha-folder/notes/
    await window.getByText('nested-note.md').click();
    await window.waitForSelector('.ProseMirror', { timeout: 2_000 });

    await deleteFolderFromContextMenu({ electronApp });

    await window.getByText('alpha-folder').click({ button: 'right' });

    await confirmDeletion({ window });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('alpha-folder')).not.toBeVisible({
      timeout: 2_000,
    });
    // Editor should no longer show the deleted file
    await expect(window.locator('.ProseMirror')).not.toBeVisible({
      timeout: 3_000,
    });
  });

  test('delete an empty sub-folder', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await deleteFolderFromContextMenu({ electronApp });

    await window.getByText('gamma-folder').click({ button: 'right' });

    await confirmDeletion({ window });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('gamma-folder')).not.toBeVisible({
      timeout: 2_000,
    });
    // Other folders should remain
    await expect(explorer.getByText('alpha-folder')).toBeVisible();
    await expect(explorer.getByText('beta-folder')).toBeVisible();
  });

  test('delete a folder containing a non-document file', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await deleteFolderFromContextMenu({ electronApp });

    // beta-folder contains both beta-doc.md and image1.png (a non-document file)
    await window.getByText('beta-folder').click({ button: 'right' });

    await confirmDeletion({ window });

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('beta-folder')).not.toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('beta-doc.md')).not.toBeVisible({
      timeout: 2_000,
    });
    // Other folders should remain
    await expect(explorer.getByText('alpha-folder')).toBeVisible();
  });

  test('delete a folder via keyboard shortcut', async ({
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

    // Click the folder to focus it in the tree
    await explorer.getByText('beta-folder').click();

    // Press the platform-appropriate delete shortcut
    await window.keyboard.press(deleteKey);

    await confirmDeletion({ window });

    await expect(explorer.getByText('beta-folder')).not.toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('beta-doc.md')).not.toBeVisible({
      timeout: 2_000,
    });
    // Other folders should remain
    await expect(explorer.getByText('alpha-folder')).toBeVisible();
  });
});

test.describe('file rename', () => {
  test('rename a file in project root', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    await renameFileFromContextMenu({ electronApp });

    await window.getByText('hello').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await input.fill('renamed');
    await window.keyboard.press('Enter');

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('renamed')).toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('hello')).not.toBeVisible({
      timeout: 2_000,
    });
  });

  test('rename a file in a subfolder', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await renameFileFromContextMenu({ electronApp });

    await window.getByText('beta-doc.md').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await input.fill('gamma-doc');
    await window.keyboard.press('Enter');

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('gamma-doc')).toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('beta-doc.md')).not.toBeVisible({
      timeout: 2_000,
    });
  });

  test('rename the currently-open file', async ({
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
    await expect(window.locator('.ProseMirror')).toBeVisible();

    await renameFileFromContextMenu({ electronApp });

    const explorer = window.getByTestId('file-explorer');
    await explorer.getByText('hello').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await input.fill('renamed-hello');
    await window.keyboard.press('Enter');

    await expect(explorer.getByText('renamed-hello')).toBeVisible({
      timeout: 2_000,
    });
    // Editor should still be visible after rename
    await expect(window.locator('.ProseMirror')).toBeVisible();
  });

  test('abort rename with Escape keeps original name', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    await renameFileFromContextMenu({ electronApp });

    await window.getByText('hello').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await window.keyboard.press('Escape');

    // Input should be gone and original name preserved
    await expect(input).not.toBeVisible({ timeout: 500 });
    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('hello')).toBeVisible();
  });

  test('abort rename with empty input keeps original name', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    await renameFileFromContextMenu({ electronApp });

    await window.getByText('hello').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await input.fill('');
    await window.keyboard.press('Enter');

    // Input should be gone and original name preserved
    await expect(input).not.toBeVisible({ timeout: 500 });
    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('hello')).toBeVisible();
  });

  test('name collision shows error and keeps input visible', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    await renameFileFromContextMenu({ electronApp });

    const explorer = window.getByTestId('file-explorer');
    await window.getByText('hello').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    // First collision: rename 'hello' to the already-existing 'world'
    await input.clear();
    await input.fill('world');
    await window.keyboard.press('Enter');
    // Input should remain visible
    await expect(input).toBeVisible();
    // Error tooltip is set
    await expect(input).toHaveAttribute('title');
    await expect(explorer.getByText('world')).toBeVisible();

    // Type something to clear the error state
    await window.keyboard.type('x');
    await expect(input).not.toHaveAttribute('title');

    // Second collision: try the same conflicting name again
    await input.clear();
    await input.fill('world');
    await window.keyboard.press('Enter');
    // Input should remain visible
    await expect(input).toBeVisible();
    // Error tooltip is set
    await expect(input).toHaveAttribute('title');
    await expect(explorer.getByText('world')).toBeVisible();
  });

  test('rename a file via keyboard shortcut', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // Click the file to select it (left click)
    await window.getByText('beta-doc.md').click();

    // Press the platform-appropriate rename key (Enter on Mac, F2 on Linux/Windows)
    await window.keyboard.press(renameKey);

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await input.fill('keyboard-renamed');
    await window.keyboard.press('Enter');

    const explorer = window.getByTestId('file-explorer');
    await expect(explorer.getByText('keyboard-renamed')).toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('beta-doc.md')).not.toBeVisible({
      timeout: 2_000,
    });
  });
});

test.describe('folder rename', () => {
  test('rename a folder in project root', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await renameFolderFromContextMenu({ electronApp });

    const explorer = window.getByTestId('file-explorer');
    await explorer.getByText('beta-folder').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await input.clear();
    await input.fill('renamed-folder');
    await window.keyboard.press('Enter');

    await expect(explorer.getByText('renamed-folder')).toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('beta-folder')).not.toBeVisible({
      timeout: 2_000,
    });
  });

  test('rename a folder in a subfolder', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await renameFolderFromContextMenu({ electronApp });

    // All nodes start expanded; notes is already visible inside alpha-folder
    const explorer = window.getByTestId('file-explorer');
    await explorer.getByText('notes').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await input.clear();
    await input.fill('memos');
    await window.keyboard.press('Enter');

    await expect(explorer.getByText('memos')).toBeVisible({ timeout: 2_000 });
    await expect(explorer.getByText('notes')).not.toBeVisible({
      timeout: 2_000,
    });
  });

  test('rename the folder containing the currently-open file', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // Open the file inside beta-folder (all nodes start expanded)
    const explorer = window.getByTestId('file-explorer');
    await explorer.getByText('beta-doc.md').click();
    await expect(window.locator('.ProseMirror')).toBeVisible();

    await renameFolderFromContextMenu({ electronApp });

    await explorer.getByText('beta-folder').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await input.clear();
    await input.fill('renamed-beta');
    await window.keyboard.press('Enter');

    await expect(explorer.getByText('renamed-beta')).toBeVisible({
      timeout: 2_000,
    });
    // Editor should still be visible after rename
    await expect(window.locator('.ProseMirror')).toBeVisible();
  });

  test('abort rename with Escape keeps original name', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await renameFolderFromContextMenu({ electronApp });

    const explorer = window.getByTestId('file-explorer');
    await explorer.getByText('beta-folder').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await window.keyboard.press('Escape');

    await expect(input).not.toBeVisible({ timeout: 500 });
    await expect(explorer.getByText('beta-folder')).toBeVisible();
  });

  test('name collision shows error and keeps input visible', async ({
    electronApp,
    window,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    await renameFolderFromContextMenu({ electronApp });

    const explorer = window.getByTestId('file-explorer');
    await explorer.getByText('alpha-folder').click({ button: 'right' });

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    // Try to rename alpha-folder to beta-folder (already exists)
    await input.clear();
    await input.fill('beta-folder');
    await window.keyboard.press('Enter');

    // Input should remain visible
    await expect(input).toBeVisible();
    // Error tooltip is set
    await expect(input).toHaveAttribute('title');
    // The conflicting folder still exists (alpha-folder is in rename mode so its
    // text is inside the input, not a text node — check beta-folder instead)
    await expect(explorer.getByText('beta-folder')).toBeVisible();
  });

  test('rename a folder via keyboard shortcut', async ({
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

    // Click the folder to select it (left click)
    await explorer.getByText('beta-folder').click();

    // Press the platform-appropriate rename key (Enter on Mac, F2 on Linux/Windows)
    await window.keyboard.press(renameKey);

    const input = window.locator('input[type="text"]');
    await input.waitFor({ state: 'visible', timeout: 500 });

    await input.clear();
    await input.fill('keyboard-renamed-folder');
    await window.keyboard.press('Enter');

    await expect(explorer.getByText('keyboard-renamed-folder')).toBeVisible({
      timeout: 2_000,
    });
    await expect(explorer.getByText('beta-folder')).not.toBeVisible({
      timeout: 2_000,
    });
  });
});
