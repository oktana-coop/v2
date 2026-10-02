import { expect, test } from '../shared/fixtures';
import {
  clickToolbarButton,
  commitChanges,
  enableShowDiff,
  focusParagraph,
  navigateToProjectHistory,
  openEditorToolbar,
  openHelloMd,
  openProjectFolder,
  selectChangedDocument,
  selectFirstCommit,
  selectUncommittedChanges,
  toggleProjectCommit,
  typeInEditorAndWaitForDebounce,
  typeInParagraphAndWaitForDebounce,
} from '../shared/helpers';

test.describe('diff controls', () => {
  test('diffing can be turned on for uncommitted changes', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' v1' });
    await commitChanges({ window, message: 'base commit' });

    await typeInEditorAndWaitForDebounce({ window, text: ' v2' });
    await selectUncommittedChanges({ window });

    await enableShowDiff({ window });

    // The document-history panel should still be visible
    await expect(window.getByTestId('document-history')).toBeVisible();
  });

  test('diffing can be turned on for every commit but the first', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' first' });
    await commitChanges({ window, message: 'first commit' });

    // Any commit with a predecessor should show the diff controls
    await selectFirstCommit({ window, commitMessage: 'first commit' });
    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });
    await expect(window.getByLabel(/show diff with/i)).toBeVisible();

    // The initial snapshot has nothing to diff against, so it hides them
    await selectFirstCommit({ window, commitMessage: 'Set up versioning' });
    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });
    await expect(window.getByLabel(/show diff with/i)).toBeHidden();
  });
});

test.describe('diff annotations', () => {
  test('highlight text inserted by a commit', async ({
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

    await typeInParagraphAndWaitForDebounce({ window, text: ' first' });
    await commitChanges({ window, message: 'first commit' });

    await typeInParagraphAndWaitForDebounce({ window, text: ' second' });
    await commitChanges({ window, message: 'second commit' });

    await selectFirstCommit({ window, commitMessage: 'second commit' });

    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });

    await enableShowDiff({ window });

    // The inserted text "second" should be highlighted with the insert diff class
    const insertAnnotation = window.locator('.ProseMirror .diff-insert');
    await expect(insertAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(insertAnnotation).toContainText('second');
  });

  test('highlight text inserted since the last commit', async ({
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

    await typeInParagraphAndWaitForDebounce({ window, text: ' baseline' });
    await commitChanges({ window, message: 'baseline' });

    await typeInParagraphAndWaitForDebounce({ window, text: ' new addition' });
    await selectUncommittedChanges({ window });

    await enableShowDiff({ window });

    // The inserted text "new addition" should be highlighted as an insert
    const insertAnnotation = window.locator('.ProseMirror .diff-insert');
    await expect(insertAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(insertAnnotation).toContainText('new addition');
  });

  test('highlight bolded text as modified', async ({
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

    await typeInParagraphAndWaitForDebounce({ window, text: ' one two three' });
    await commitChanges({ window, message: 'before bold' });

    // Select the paragraph text and bold it (Home → Shift+End is cross-platform)
    await focusParagraph({ window });
    await window.keyboard.press('Home');
    await window.keyboard.press('Shift+End');
    await clickToolbarButton({ window, label: 'Bold' });
    await commitChanges({ window, message: 'after bold' });

    await selectFirstCommit({ window, commitMessage: 'after bold' });
    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });

    await enableShowDiff({ window });

    // The bolded word should be highlighted with the modify class
    const modifyAnnotation = window.locator('.ProseMirror .diff-modify');
    await expect(modifyAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(modifyAnnotation).toContainText('three');
  });

  test('highlight a changed heading level as modified', async ({
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
    await openEditorToolbar({ window });

    await typeInEditorAndWaitForDebounce({ window, text: ' original' });
    await commitChanges({ window, message: 'before heading change' });

    // Change heading from H1 to H2 via block select dropdown
    await window.locator('.ProseMirror h1').click();
    await window.locator('[data-slot="control"]').click();
    await window.getByRole('option', { name: 'Heading 2' }).click();
    await commitChanges({ window, message: 'after heading change' });

    await selectFirstCommit({ window, commitMessage: 'after heading change' });
    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });

    await enableShowDiff({ window });

    // The heading text should be highlighted with the modify class
    const modifyAnnotation = window.locator('.ProseMirror .diff-modify');
    await expect(modifyAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(modifyAnnotation).toContainText('Hello');
  });

  test('highlight text inserted by a commit in the project history', async ({
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

    // The inserted text "version two" should be highlighted as an insert
    const insertAnnotation = window.locator('.ProseMirror .diff-insert');
    await expect(insertAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(insertAnnotation).toContainText('version two');
  });
});
