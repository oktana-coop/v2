import { Page } from '@playwright/test';

import { expect, test } from '../shared/fixtures';
import {
  commitAllProjectChanges,
  navigateToProjectHistory,
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

test.describe('commit to project (multi-doc)', () => {
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

    // The history sidebar in the document view should show the new commit.
    const docCommits = window.getByTestId('history-commit');
    await expect(docCommits).toHaveCount(1);
    await expect(docCommits.first()).toContainText('project-scoped commit');

    // Project history should contain a single commit with both documents.
    await navigateToProjectHistory({ window });
    const projectCommits = window.getByTestId('project-commit-row');
    await expect(projectCommits).toHaveCount(1);
    await expect(projectCommits.first()).toContainText('project-scoped commit');

    await toggleProjectCommit({
      window,
      commitMessage: 'project-scoped commit',
    });
    const changedDocs = window.getByTestId('changed-document-row');
    await expect(changedDocs.filter({ hasText: 'hello' })).toHaveCount(1);
    await expect(changedDocs.filter({ hasText: 'world' })).toHaveCount(1);
  });

  test('works from the document history view (uncommitted changes screen)', async ({
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

    // Project history should contain a single commit with both documents,
    // matching the outcome of the same flow fired from the editor view.
    await navigateToProjectHistory({ window });
    const projectCommits = window.getByTestId('project-commit-row');
    await expect(projectCommits).toHaveCount(1);
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
