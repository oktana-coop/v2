import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from './shared/fixtures';
import {
  clickToolbarButton,
  commitChanges,
  discardChanges,
  enableShowDiff,
  openEditorToolbar,
  openHelloMd,
  openProjectFolder,
  restoreCommit,
  returnToEditor,
  selectFirstCommit,
  selectUncommittedChanges,
  typeInEditorAndWaitForDebounce,
} from './shared/helpers';

// TODO: clicking `.ProseMirror p` directly doesn't move the ProseMirror
// cursor into the paragraph — it stays at the beginning of the document.
// Using ArrowDown as a workaround until we understand why.
const focusParagraph = async (window: Page) => {
  await window.locator('.ProseMirror').click();
  await window.keyboard.press('ArrowDown');
};

const typeInParagraphAndWaitForDebounce = async ({
  window,
  text,
  waitFor = 350,
}: {
  window: Page;
  text: string;
  waitFor?: number;
}) => {
  await focusParagraph(window);
  await window.keyboard.press('End');
  await window.keyboard.type(text);
  await window.waitForTimeout(waitFor);
};

test('commit flow: edit → commit → one commit in history', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' first edit' });
  await commitChanges({ window, message: 'first commit' });

  const commits = window.getByTestId('history-commit');
  await expect(commits).toHaveCount(1);
  await expect(commits.first()).toContainText('first commit');
});

test('view uncommitted changes and show diff', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' v1' });
  await commitChanges({ window, message: 'base commit' });

  await typeInEditorAndWaitForDebounce({ window, text: ' v2' });
  await selectUncommittedChanges({ window });

  await enableShowDiff({ window });

  // The document-history panel should still be visible
  await expect(window.getByTestId('document-history')).toBeVisible();
});

test('commit from history view → two commits in history', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' first' });
  await commitChanges({ window, message: 'first commit' });

  await typeInEditorAndWaitForDebounce({ window, text: ' second' });
  await selectUncommittedChanges({ window });
  await commitChanges({ window, message: 'second commit' });

  const commits = window.getByTestId('history-commit');
  await expect(commits).toHaveCount(2);
});

test('first commit shows its content', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' first version' });
  await commitChanges({ window, message: 'first commit' });

  await typeInEditorAndWaitForDebounce({ window, text: ' second version' });
  await commitChanges({ window, message: 'second commit' });

  await selectFirstCommit({ window, commitMessage: 'first commit' });

  await expect(window.locator('.ProseMirror')).toContainText('first version', {
    timeout: 300,
  });
});

test('discard: edit → commit → edit → discard → content reverted', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' first version' });
  await commitChanges({ window, message: 'first commit' });

  await typeInEditorAndWaitForDebounce({ window, text: ' extra' });
  await selectUncommittedChanges({ window });
  await discardChanges({ window });

  const editor = window.locator('.ProseMirror');
  await expect(editor).not.toContainText('extra');

  const content = fs.readFileSync(
    path.join(testProjectDir, 'hello.md'),
    'utf8'
  );
  expect(content).not.toContain('extra');
});

test('commits are ordered most recent first', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' alpha' });
  await commitChanges({ window, message: 'alpha commit' });

  await typeInEditorAndWaitForDebounce({ window, text: ' beta' });
  await commitChanges({ window, message: 'beta commit' });

  const commits = window.getByTestId('history-commit');
  await expect(commits).toHaveCount(2);
  await expect(commits.first()).toContainText('beta commit');
  await expect(commits.last()).toContainText('alpha commit');
});

test('diff annotations appear on a committed change', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInParagraphAndWaitForDebounce({ window, text: ' first' });
  await commitChanges({ window, message: 'first commit' });

  await typeInParagraphAndWaitForDebounce({ window, text: ' second' });
  await commitChanges({ window, message: 'second commit' });

  await selectFirstCommit({ window, commitMessage: 'second commit' });

  await expect(window.locator('.ProseMirror')).toBeVisible({ timeout: 1_000 });

  await enableShowDiff({ window });

  // The inserted text "second" should be highlighted with the green diff class
  const insertAnnotation = window.locator('.ProseMirror .bg-green-300');
  await expect(insertAnnotation).toBeVisible({ timeout: 1_000 });
  await expect(insertAnnotation).toContainText('second');
});

test('diff annotations appear on uncommitted changes', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInParagraphAndWaitForDebounce({ window, text: ' baseline' });
  await commitChanges({ window, message: 'baseline' });

  await typeInParagraphAndWaitForDebounce({ window, text: ' new addition' });
  await selectUncommittedChanges({ window });

  await enableShowDiff({ window });

  // The inserted text "new addition" should be highlighted green
  const insertAnnotation = window.locator('.ProseMirror .bg-green-300');
  await expect(insertAnnotation).toBeVisible({ timeout: 1_000 });
  await expect(insertAnnotation).toContainText('new addition');
});

test('bolding text shows modify annotation in diff', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInParagraphAndWaitForDebounce({ window, text: ' one two three' });
  await commitChanges({ window, message: 'before bold' });

  // Place cursor at end of paragraph, select last word, bold it
  await focusParagraph(window);
  await window.keyboard.press('End');
  await window.keyboard.press('Alt+Shift+ArrowLeft');
  await clickToolbarButton({ window, label: 'Bold' });
  await commitChanges({ window, message: 'after bold' });

  await selectFirstCommit({ window, commitMessage: 'after bold' });
  await expect(window.locator('.ProseMirror')).toBeVisible({ timeout: 1_000 });

  await enableShowDiff({ window });

  // The bolded word should be highlighted with the purple modify class
  const modifyAnnotation = window.locator('.ProseMirror .bg-purple-100');
  await expect(modifyAnnotation).toBeVisible({ timeout: 1_000 });
  await expect(modifyAnnotation).toContainText('three');
});

test('changing heading type shows modify annotation in diff', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
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
  await expect(window.locator('.ProseMirror')).toBeVisible({ timeout: 1_000 });

  await enableShowDiff({ window });

  // The heading text should be highlighted with the purple modify class
  const modifyAnnotation = window.locator('.ProseMirror .bg-purple-100');
  await expect(modifyAnnotation).toBeVisible({ timeout: 1_000 });
  await expect(modifyAnnotation).toContainText('Hello');
});

test('restore commit reverts content and creates a new commit', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' original' });
  await commitChanges({ window, message: 'original commit' });

  await typeInEditorAndWaitForDebounce({ window, text: ' changed' });
  await commitChanges({ window, message: 'changed commit' });

  // Select the older commit and restore it
  await selectFirstCommit({ window, commitMessage: 'original commit' });
  await restoreCommit({ window });

  // A new "Restore" commit should appear
  const commits = window.getByTestId('history-commit');
  await expect(commits).toHaveCount(3);
  await expect(commits.first()).toContainText('Restore');

  // Return to editor and verify content matches the original
  await returnToEditor({ window });
  const editor = window.locator('.ProseMirror');
  await expect(editor).toContainText('original', { timeout: 500 });
  await expect(editor).not.toContainText('changed');
});

test('restore commit updates file on disk', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' keep this' });
  await commitChanges({ window, message: 'good state' });

  await typeInEditorAndWaitForDebounce({ window, text: ' remove this' });
  await commitChanges({ window, message: 'bad state' });

  await selectFirstCommit({ window, commitMessage: 'good state' });
  await restoreCommit({ window });

  // Verify the file on disk reflects the restored content
  const content = fs.readFileSync(
    path.join(testProjectDir, 'hello.md'),
    'utf8'
  );
  expect(content).toContain('keep this');
  expect(content).not.toContain('remove this');
});

test('view uncommitted changes then discard them', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' stable' });
  await commitChanges({ window, message: 'stable commit' });

  await typeInEditorAndWaitForDebounce({ window, text: ' temporary' });
  await selectUncommittedChanges({ window });

  // Verify uncommitted content is displayed
  await expect(window.locator('.ProseMirror')).toContainText('temporary', {
    timeout: 500,
  });

  await discardChanges({ window });

  // Uncommitted changes row should be gone
  await expect(window.getByTestId('uncommitted-changes')).toBeHidden();

  // Editor should show only the committed content
  const editor = window.locator('.ProseMirror');
  await expect(editor).toContainText('stable');
  await expect(editor).not.toContainText('temporary');
});

test('history is non-destructive: uncommitted changes preserved', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({ window, text: ' baseline' });
  await commitChanges({ window, message: 'baseline commit' });

  await typeInEditorAndWaitForDebounce({ window, text: ' more text' });

  await selectUncommittedChanges({ window });

  // Return to editor without discarding
  await returnToEditor({ window });

  // Editor reloads from disk — the saved "more text" should be present
  await expect(window.locator('.ProseMirror')).toContainText('more text');
});
