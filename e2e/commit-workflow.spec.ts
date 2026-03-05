import fs from 'fs';
import path from 'path';

import { expect, test } from './fixtures';
import {
  commitChanges,
  discardChanges,
  openHelloMd,
  openProjectFolder,
  returnToEditor,
  selectHistoryCommit,
  selectUncommittedChanges,
} from './helpers';

// Helper: type text at end of current editor line
async function typeInEditor(
  window: import('@playwright/test').Page,
  text: string
): Promise<void> {
  const editor = window.locator('.ProseMirror');
  await editor.click();
  await window.keyboard.press('End');
  await window.keyboard.type(text);
}

test('commit flow: edit → commit → one commit in history', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  await typeInEditor(window, ' first edit');
  await window.waitForTimeout(500);
  await commitChanges(window, 'first commit');

  const commits = window.getByTestId('history-commit');
  await expect(commits).toHaveCount(1);
  await expect(commits.first()).toContainText('first commit');
});

test('view uncommitted changes and show diff', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  await typeInEditor(window, ' v1');
  await commitChanges(window, 'base commit');

  await typeInEditor(window, ' v2');
  await selectUncommittedChanges(window);

  // Enable "Show Diff with" checkbox
  const showDiffCheckbox = window.getByLabel(/show diff with/i);
  await showDiffCheckbox.check();

  // The document-history panel should still be visible
  await expect(window.getByTestId('document-history')).toBeVisible();
});

test('commit from history view → two commits in history', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  await typeInEditor(window, ' first');
  await commitChanges(window, 'first commit');

  await typeInEditor(window, ' second');
  await selectUncommittedChanges(window);
  await commitChanges(window, 'second commit');

  const commits = window.getByTestId('history-commit');
  await expect(commits).toHaveCount(2);
});

test('first commit shows its content', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  await typeInEditor(window, ' first version');
  await commitChanges(window, 'first commit');

  await typeInEditor(window, ' second version');
  await commitChanges(window, 'second commit');

  // Navigate to first commit in history
  await selectHistoryCommit(window, 'first commit');

  // The ReadOnlyView renders ProseMirror content asynchronously
  await expect(window.locator('.ProseMirror')).toContainText('first version', {
    timeout: 3_000,
  });
});

test('discard: edit → commit → edit → discard → content reverted', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  await typeInEditor(window, ' first version');
  await commitChanges(window, 'first commit');

  await typeInEditor(window, ' extra');
  await selectUncommittedChanges(window);
  await discardChanges(window);

  const editor = window.locator('.ProseMirror');
  await expect(editor).not.toContainText('extra');

  // Also verify the file on disk
  await window.waitForTimeout(500);
  const content = fs.readFileSync(
    path.join(testProjectDir, 'hello.md'),
    'utf8'
  );
  expect(content).not.toContain('extra');
});

test('history is non-destructive: uncommitted changes preserved', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  await typeInEditor(window, ' baseline');
  await commitChanges(window, 'baseline commit');

  await typeInEditor(window, ' more text');

  // Wait for the 300 ms auto-save debounce to flush before navigating away
  await window.waitForTimeout(500);

  await selectUncommittedChanges(window);

  // Return to editor without discarding
  await returnToEditor(window);

  // Editor reloads from disk — the saved "more text" should be present
  await expect(window.locator('.ProseMirror')).toContainText('more text');
});
