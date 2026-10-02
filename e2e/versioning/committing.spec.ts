import { Page } from '@playwright/test';

import { expect, test } from '../shared/fixtures';
import {
  commitAllProjectChanges,
  commitChanges,
  navigateToProjectHistory,
  openCommandPalette,
  openHelloMd,
  openProjectFolder,
  selectUncommittedChanges,
  toggleProjectCommit,
  typeInEditorAndWaitForDebounce,
} from '../shared/helpers';

const openWorldMd = async ({ window }: { window: Page }): Promise<void> => {
  await window.getByText('world').click();
  await window.waitForSelector('.ProseMirror', { timeout: 2_000 });
};

test.describe('committing a document', () => {
  test('a commit goes on top of the history and leaves nothing to commit', async ({
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
    const commitButton = window.getByRole('button', {
      name: /commit changes/i,
    });
    await expect(commitButton).toBeDisabled();

    await typeInEditorAndWaitForDebounce({ window, text: ' first edit' });
    await expect(window.getByTestId('uncommitted-changes')).toBeVisible();
    await expect(commitButton).toBeEnabled();

    await commitChanges({ window, message: 'first commit' });

    // The new commit sits on top of the initial snapshot taken when the folder was opened.
    const commits = window.getByTestId('history-commit');
    await expect(commits).toHaveCount(2);
    await expect(commits.first()).toContainText('first commit');
    await expect(window.getByTestId('uncommitted-changes')).toHaveCount(0);
    await expect(commitButton).toBeDisabled();
  });

  test('commits from the uncommitted changes view', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' second' });
    await selectUncommittedChanges({ window });
    await commitChanges({ window, message: 'second commit' });

    // The new commits sit on top of the initial snapshot taken when the folder was opened.
    const commits = window.getByTestId('history-commit');
    await expect(commits).toHaveCount(3);
  });

  test('the palette offers committing only when there is something to commit', async ({
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
    const commitButton = window.getByRole('button', {
      name: /commit changes/i,
    });
    const commitOption = window.getByRole('option', {
      name: /^Commit changes/,
    });
    await expect(commitButton).toBeDisabled();

    await openCommandPalette({ window });
    await expect(commitOption).toHaveCount(0);
    await window.keyboard.press('Escape');

    await typeInEditorAndWaitForDebounce({ window, text: ' palette edit' });
    await expect(commitButton).toBeEnabled();

    await openCommandPalette({ window });
    await expect(commitOption).toBeVisible();
  });
});

test.describe('committing all project changes', () => {
  test('bundles uncommitted changes across documents into one commit', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    // Edit the first document and leave the changes uncommitted.
    await openHelloMd({ window });
    await typeInEditorAndWaitForDebounce({ window, text: ' hello edit' });

    // Switch to the second document and edit it as well.
    await openWorldMd({ window });
    await typeInEditorAndWaitForDebounce({ window, text: ' world edit' });

    // Trigger the project-scoped commit from the second document's editor.
    await commitAllProjectChanges({
      window,
      message: 'project-scoped commit',
    });

    // The history sidebar in the document view should show the new commit on
    // top of the initial snapshot taken when the folder was opened.
    const docCommits = window.getByTestId('history-commit');
    await expect(docCommits).toHaveCount(2);
    await expect(docCommits.first()).toContainText('project-scoped commit');

    // Project history should contain a single new commit with both documents.
    await navigateToProjectHistory({ window });
    const projectCommits = window.getByTestId('project-commit-row');
    await expect(projectCommits).toHaveCount(2);
    await expect(projectCommits.first()).toContainText('project-scoped commit');

    await toggleProjectCommit({
      window,
      commitMessage: 'project-scoped commit',
    });
    const changedDocs = window.getByTestId('changed-document-row');
    await expect(changedDocs.filter({ hasText: 'hello' })).toHaveCount(1);
    await expect(changedDocs.filter({ hasText: 'world' })).toHaveCount(1);
  });

  test('commits all project changes from the uncommitted changes view', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    // Edit both documents.
    await openHelloMd({ window });
    await typeInEditorAndWaitForDebounce({ window, text: ' hello edit' });
    await openWorldMd({ window });
    await typeInEditorAndWaitForDebounce({ window, text: ' world edit' });

    // Switch from the editor to the document history view (uncommitted-changes
    // screen) and trigger the project-scoped commit from there.
    await selectUncommittedChanges({ window });
    await commitAllProjectChanges({
      window,
      message: 'project commit from history view',
    });

    // Project history should contain a single new commit with both documents,
    // matching the outcome of the same flow fired from the editor view.
    await navigateToProjectHistory({ window });
    const projectCommits = window.getByTestId('project-commit-row');
    await expect(projectCommits).toHaveCount(2);
    await expect(projectCommits.first()).toContainText(
      'project commit from history view'
    );

    await toggleProjectCommit({
      window,
      commitMessage: 'project commit from history view',
    });
    const changedDocs = window.getByTestId('changed-document-row');
    await expect(changedDocs.filter({ hasText: 'hello' })).toHaveCount(1);
    await expect(changedDocs.filter({ hasText: 'world' })).toHaveCount(1);
  });
});
