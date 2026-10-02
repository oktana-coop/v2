import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  commitChanges,
  discardChanges,
  openHelloMd,
  openProjectFolder,
  restoreCommit,
  returnToEditor,
  selectFirstCommit,
  selectUncommittedChanges,
  typeInEditorAndWaitForDebounce,
} from '../shared/helpers';

test.describe('discarding', () => {
  test('reverts the editor and the file to the last commit', async ({
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

    await returnToEditor({ window });
    await expect(editor).not.toContainText('extra');
    await expect(
      window.getByRole('button', { name: /commit changes/i })
    ).toBeDisabled();
  });

  test('removes the uncommitted changes from the history', async ({
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
});

test.describe('restoring', () => {
  test('brings back the content of a commit in a new commit', async ({
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

    await typeInEditorAndWaitForDebounce({ window, text: ' original' });
    await commitChanges({ window, message: 'original commit' });

    await typeInEditorAndWaitForDebounce({ window, text: ' changed' });
    await commitChanges({ window, message: 'changed commit' });

    // Select the older commit and restore it
    await selectFirstCommit({ window, commitMessage: 'original commit' });
    await restoreCommit({ window });

    // A new "Restore" commit should appear
    const commits = window.getByTestId('history-commit');
    // There is also an initial snapshot commit taken when the folder was opened.
    await expect(commits).toHaveCount(4);
    await expect(commits.first()).toContainText('Restore');
    await expect(window.getByTestId('uncommitted-changes')).toHaveCount(0);

    // Return to editor and verify content matches the original
    await returnToEditor({ window });
    const editor = window.locator('.ProseMirror');
    await expect(editor).toContainText('original', { timeout: 500 });
    await expect(editor).not.toContainText('changed');
    await expect(
      window.getByRole('button', { name: /commit changes/i })
    ).toBeDisabled();
  });

  test('writes the content of the commit to the file', async ({
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
});
