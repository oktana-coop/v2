import fs from 'fs';
import path from 'path';

import { expect, test } from './fixtures';
import {
  commitChanges,
  discardChanges,
  openHelloMd,
  openProjectFolder,
  returnToEditor,
  selectFirstCommit,
  selectUncommittedChanges,
  typeInEditorAndWaitForDebounce,
} from './helpers';

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
