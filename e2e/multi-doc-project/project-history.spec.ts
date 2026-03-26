import { expect, test } from '../shared/fixtures';
import {
  commitChanges,
  confirmDeletion,
  deleteFileFromContextMenu,
  enableShowDiff,
  navigateToProjectHistory,
  openHelloMd,
  openProjectFolder,
  selectChangedDocument,
  selectUncommittedDocument,
  toggleProjectCommit,
  typeInEditorAndWaitForDebounce,
} from '../shared/helpers';

test.describe('project history', () => {
  test('shows commits in the sidebar', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' first edit' });
    await commitChanges({ window, message: 'first commit' });

    await typeInEditorAndWaitForDebounce({ window, text: ' second edit' });
    await commitChanges({ window, message: 'second commit' });

    await navigateToProjectHistory({ window });

    const commitRows = window.getByTestId('project-commit-row');
    await expect(commitRows).toHaveCount(2);
    await expect(commitRows.first()).toContainText('second commit');
    await expect(commitRows.last()).toContainText('first commit');
  });

  test('expand a commit to see changed documents', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' edit' });
    await commitChanges({ window, message: 'edit hello' });

    await navigateToProjectHistory({ window });
    await toggleProjectCommit({ window, commitMessage: 'edit hello' });

    const helloDocs = window
      .getByTestId('changed-document-row')
      .filter({ hasText: 'hello' });
    await expect(helloDocs.first()).toBeVisible();
  });

  test('click a changed document to view its content', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' unique content' });
    await commitChanges({ window, message: 'add unique content' });

    await navigateToProjectHistory({ window });
    await toggleProjectCommit({
      window,
      commitMessage: 'add unique content',
    });
    await selectChangedDocument({ window, fileName: 'hello' });

    // The read-only ProseMirror view should show the document content
    await expect(window.locator('.ProseMirror')).toContainText(
      'unique content',
      { timeout: 1_000 }
    );
  });

  test('uncommitted changes panel shows modified files', async ({
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

    // Create a commit first so there's a baseline
    await typeInEditorAndWaitForDebounce({ window, text: ' baseline' });
    await commitChanges({ window, message: 'baseline' });

    // Make a pending edit
    await typeInEditorAndWaitForDebounce({ window, text: ' pending edit' });

    await navigateToProjectHistory({ window });

    const uncommittedPanel = window.getByTestId('uncommitted-changes-panel');
    const helloRow = uncommittedPanel
      .getByTestId('changed-document-row')
      .filter({ hasText: 'hello' });
    await expect(helloRow.first()).toBeVisible();
  });

  test('click an uncommitted document to view it', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' baseline' });
    await commitChanges({ window, message: 'baseline' });

    await typeInEditorAndWaitForDebounce({
      window,
      text: ' pending change',
    });

    await navigateToProjectHistory({ window });
    await selectUncommittedDocument({ window, fileName: 'hello' });

    await expect(window.locator('.ProseMirror')).toContainText(
      'pending change',
      { timeout: 1_000 }
    );
  });

  test('commit from project history view', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' to commit' });

    await navigateToProjectHistory({ window });
    await commitChanges({ window, message: 'project history commit' });

    const commitRows = window.getByTestId('project-commit-row');
    await expect(commitRows.first()).toContainText('project history commit');
  });

  test('deleted document shows last known content', async ({
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

    // Commit initial content so there's a baseline
    await typeInEditorAndWaitForDebounce({ window, text: ' preserved' });
    await commitChanges({ window, message: 'add content' });

    // Delete hello.md via context menu (the app auto-commits the deletion)
    await deleteFileFromContextMenu({ electronApp });
    await window
      .getByTestId('file-explorer')
      .getByText('hello')
      .click({ button: 'right' });
    await confirmDeletion({ window });

    await navigateToProjectHistory({ window });

    // The auto-committed deletion message uses "Removed <filename>"
    await toggleProjectCommit({ window, commitMessage: 'Removed hello.md' });
    await selectChangedDocument({ window, fileName: 'hello' });

    // Should show the content from before deletion
    await expect(window.locator('.ProseMirror')).toContainText('preserved', {
      timeout: 1_000,
    });
  });

  test('diff annotations appear in project history', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' version one' });
    await commitChanges({ window, message: 'first commit' });

    await typeInEditorAndWaitForDebounce({ window, text: ' version two' });
    await commitChanges({ window, message: 'second commit' });

    await navigateToProjectHistory({ window });
    await toggleProjectCommit({ window, commitMessage: 'second commit' });
    await selectChangedDocument({ window, fileName: 'hello' });

    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });

    await enableShowDiff({ window });

    // The inserted text "version two" should be highlighted green
    const insertAnnotation = window.locator('.ProseMirror .bg-green-300');
    await expect(insertAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(insertAnnotation).toContainText('version two');
  });
});
