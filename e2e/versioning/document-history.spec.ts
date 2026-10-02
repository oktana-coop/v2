import { type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  commitChanges,
  createAndSwitchToBranch,
  openDocument,
  openDocumentExpectingContent,
  openHelloMd,
  openProjectFolder,
  renameFileFromContextMenu,
  renameFileInput,
  returnToEditor,
  selectFirstCommit,
  selectUncommittedChanges,
  switchToBranch,
  typeInEditorAndWaitForDebounce,
} from '../shared/helpers';

const commitButton = (window: Page) =>
  window.getByRole('button', { name: /commit changes/i });

const historyCommits = (window: Page) => window.getByTestId('history-commit');

const uncommittedChanges = (window: Page) =>
  window.getByTestId('uncommitted-changes');

test.describe("the open document's history", () => {
  test('commits are listed with the most recent first', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' alpha' });
    await commitChanges({ window, message: 'alpha commit' });

    await typeInEditorAndWaitForDebounce({ window, text: ' beta' });
    await commitChanges({ window, message: 'beta commit' });

    // The new commits sit on top of the initial snapshot taken when the folder was opened.
    const commits = historyCommits(window);
    await expect(commits).toHaveCount(3);
    await expect(commits.first()).toContainText('beta commit');
    await expect(commits.nth(1)).toContainText('alpha commit');
    await expect(commits.last()).toContainText('Set up versioning');
  });

  test('selecting a commit shows the document as it was then', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' first version' });
    await commitChanges({ window, message: 'first commit' });

    await typeInEditorAndWaitForDebounce({ window, text: ' second version' });
    await commitChanges({ window, message: 'second commit' });

    await selectFirstCommit({ window, commitMessage: 'first commit' });

    await expect(window.locator('.ProseMirror')).toContainText(
      'first version',
      {
        timeout: 300,
      }
    );
  });

  test('viewing uncommitted changes and going back to the editor keeps them', async ({
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
    await commitChanges({ window, message: 'baseline commit' });

    await typeInEditorAndWaitForDebounce({ window, text: ' more text' });

    await selectUncommittedChanges({ window });

    // Return to editor without discarding
    await returnToEditor({ window });

    // Editor reloads from disk — the saved "more text" should be present
    await expect(window.locator('.ProseMirror')).toContainText('more text');
  });
});

test.describe('following the selected document', () => {
  test('shows the history of the document opened, not of the previous one', async ({
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
    await commitChanges({ window, message: 'edit hello' });
    await expect(historyCommits(window)).toHaveCount(2);

    await openDocumentExpectingContent({
      window,
      relativePath: 'world.md',
      content: 'Another document',
    });

    await expect(historyCommits(window)).toHaveCount(1);
    await expect(historyCommits(window)).toContainText(['Set up versioning']);
    await expect(uncommittedChanges(window)).toHaveCount(0);
    await expect(commitButton(window)).toBeDisabled();

    await openDocumentExpectingContent({
      window,
      relativePath: 'hello.md',
      content: 'hello edit',
    });

    await expect(historyCommits(window)).toHaveCount(2);
    await expect(historyCommits(window).first()).toContainText('edit hello');
  });

  test('switching quickly between documents shows the history of the last one opened', async ({
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
    await commitChanges({ window, message: 'edit hello' });

    const explorer = window.getByTestId('file-explorer');
    await explorer.getByText('world').click();
    await explorer.getByText('hello').click();
    await explorer.getByText('world').click();

    await expect(window.locator('.ProseMirror')).toContainText(
      'Another document'
    );
    await expect(historyCommits(window)).toHaveCount(1);
    await expect(historyCommits(window)).toContainText(['Set up versioning']);
    await expect(commitButton(window)).toBeDisabled();
  });

  test('keeps the uncommitted changes of a document reopened after visiting another', async ({
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
    await typeInEditorAndWaitForDebounce({ window, text: ' not committed' });
    await expect(uncommittedChanges(window)).toBeVisible();

    await openDocument({ window, relativePath: 'world.md' });
    await expect(uncommittedChanges(window)).toHaveCount(0);

    await openDocument({ window, relativePath: 'hello.md' });
    await expect(window.locator('.ProseMirror')).toContainText('not committed');
    await expect(uncommittedChanges(window)).toBeVisible();
    await expect(commitButton(window)).toBeEnabled();
  });

  test('shows the history of the open document after renaming it', async ({
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
    await commitChanges({ window, message: 'edit hello' });

    await renameFileFromContextMenu({ electronApp });
    await window
      .getByTestId('file-explorer')
      .getByText('hello.md')
      .click({ button: 'right' });
    const input = renameFileInput({ window });
    await input.waitFor({ state: 'visible', timeout: 500 });
    await input.fill('greeting.md');
    await window.keyboard.press('Enter');

    await expect(
      window.getByTestId('file-explorer').getByText('greeting.md')
    ).toBeVisible();
    await expect(window.locator('.ProseMirror')).toContainText('hello edit');
    await expect(historyCommits(window).first()).not.toContainText(
      'edit hello'
    );
  });

  test('follows the open document across a branch switch', async ({
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

    await createAndSwitchToBranch({ window, branchName: 'draft' });
    await typeInEditorAndWaitForDebounce({
      window,
      text: ' only on the draft',
    });
    await commitChanges({ window, message: 'draft edit' });
    await expect(historyCommits(window).first()).toContainText('draft edit');

    await switchToBranch({ window, from: 'draft', to: 'main' });
    await expect(window.locator('.ProseMirror')).not.toContainText(
      'only on the draft'
    );
    await expect(historyCommits(window)).toHaveCount(1);
    await expect(historyCommits(window)).toContainText(['Set up versioning']);
    await expect(commitButton(window)).toBeDisabled();

    await switchToBranch({ window, from: 'main', to: 'draft' });
    await expect(window.locator('.ProseMirror')).toContainText(
      'only on the draft'
    );
    await expect(historyCommits(window)).toHaveCount(2);
    await expect(historyCommits(window).first()).toContainText('draft edit');
  });
});

test.describe('changes made outside the app', () => {
  test('shows changes made before the document opened as uncommitted', async ({
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

    fs.writeFileSync(
      path.join(testProjectDir, 'world.md'),
      '# World\n\nChanged before opening.\n'
    );

    await openDocumentExpectingContent({
      window,
      relativePath: 'world.md',
      content: 'Changed before opening',
    });

    await expect(uncommittedChanges(window)).toBeVisible();
    await expect(commitButton(window)).toBeEnabled();
  });

  test('shows an outside edit to the open document as uncommitted', async ({
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
    await expect(commitButton(window)).toBeDisabled();

    fs.writeFileSync(
      path.join(testProjectDir, 'hello.md'),
      // A different length from the original: isomorphic-git takes a file of
      // the same size changed within the same second as unchanged.
      '# Hello\n\nChanged outside the app, at a different length.\n'
    );

    await expect(window.locator('.ProseMirror')).toContainText(
      'Changed outside the app'
    );
    await expect(uncommittedChanges(window)).toBeVisible();
    await expect(commitButton(window)).toBeEnabled();
  });
});
