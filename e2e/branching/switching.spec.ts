import { Page } from '@playwright/test';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  commitChanges,
  createAndSwitchToBranch,
  createNewFileFromButton,
  openBranchingPalette,
  openDocument,
  openProjectFolder,
  switchToBranch,
  typeInParagraphAndWaitForDebounce,
} from '../shared/helpers';

const editor = (window: Page) => window.locator('.ProseMirror');

test.describe('branch switching', () => {
  test('re-resolves the open document against the branch switched to', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openDocument({ window, relativePath: 'hello.md' });
    await expect(editor(window)).toContainText('This is a test document.');

    await createAndSwitchToBranch({ window, branchName: 'experiment' });
    await typeInParagraphAndWaitForDebounce({ window, text: ' on experiment' });
    await commitChanges({ window, message: 'experiment commit' });

    // The document stays open across the switch, showing main's content rather
    // than the version last seen on experiment.
    await switchToBranch({ window, from: 'experiment', to: 'main' });
    await expect(editor(window)).toContainText('This is a test document.');
    await expect(editor(window)).not.toContainText('on experiment');

    await switchToBranch({ window, to: 'experiment' });
    await expect(editor(window)).toContainText('on experiment');
  });

  test('resets when the open document does not exist on the branch switched to', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openDocument({ window, relativePath: 'hello.md' });

    await createAndSwitchToBranch({ window, branchName: 'experiment' });

    // A document that only ever exists on experiment.
    await createNewFileFromButton({
      electronApp,
      window,
      filePath: path.join(testProjectDir, 'experiment-only.md'),
    });
    await typeInParagraphAndWaitForDebounce({
      window,
      text: 'Only on experiment',
    });
    await commitChanges({ window, message: 'experiment commit' });
    await expect(editor(window)).toContainText('Only on experiment');

    // Driven directly rather than via `switchToBranch`, whose post-condition is
    // a visible branch button — the reset navigates away from it.
    await openBranchingPalette({ window, currentBranch: 'experiment' });
    await window.getByRole('option', { name: 'main', exact: true }).click();

    // The open document has no counterpart on main, so it cannot be re-resolved
    // against it and the app resets rather than showing a stale document.
    await expect(editor(window)).toBeHidden();
    await expect(
      window.getByRole('heading', { name: /welcome to v2/i })
    ).toBeVisible();
    await expect(
      window.getByTestId('file-explorer').getByText('experiment-only')
    ).toBeHidden();
  });
});

test.describe('switching with uncommitted changes', () => {
  test('refuses when the edited document differs between the branches', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openDocument({ window, relativePath: 'hello.md' });

    await createAndSwitchToBranch({ window, branchName: 'experiment' });
    await typeInParagraphAndWaitForDebounce({ window, text: ' on experiment' });
    await commitChanges({ window, message: 'experiment commit' });
    await switchToBranch({ window, from: 'experiment', to: 'main' });

    await typeInParagraphAndWaitForDebounce({ window, text: ' not committed' });
    await openBranchingPalette({ window, currentBranch: 'main' });
    await window
      .getByRole('option', { name: 'experiment', exact: true })
      .click();

    await expect(
      window.getByText(/would be overwritten by switching to "experiment"/)
    ).toBeVisible({ timeout: 5_000 });
    await expect(window.getByRole('button', { name: 'main' })).toBeVisible();
    await expect(editor(window)).toContainText('not committed');
  });

  // An edit to a file both branches hold alike comes along.
  test('brings an edit to a document the branches share along', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openDocument({ window, relativePath: 'hello.md' });

    await createAndSwitchToBranch({ window, branchName: 'experiment' });
    await typeInParagraphAndWaitForDebounce({ window, text: ' on experiment' });
    await commitChanges({ window, message: 'experiment commit' });

    await openDocument({ window, relativePath: 'world.md' });
    await typeInParagraphAndWaitForDebounce({ window, text: ' not committed' });
    await switchToBranch({ window, from: 'experiment', to: 'main' });

    await expect(editor(window)).toContainText('not committed');
  });
});
