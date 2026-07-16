import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import { openDocument, openProjectFolder } from '../shared/helpers';

const fileExplorer = (window: Parameters<typeof openDocument>[0]['window']) =>
  window.getByTestId('file-explorer');

test.describe('project opening', () => {
  test('git auto-init: opening a plain folder creates a .git directory', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    // testProjectDir is created with mkdtempSync — no .git initially
    expect(fs.existsSync(path.join(testProjectDir, '.git'))).toBe(false);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    // Wait for git to initialise the repo
    await window.waitForTimeout(500);

    expect(fs.existsSync(path.join(testProjectDir, '.git'))).toBe(true);
  });

  test('reopens the last opened project after a reload', async ({
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

    await window.reload();

    // The last opened project is restored from browser storage — no folder is
    // picked again here.
    await expect(fileExplorer(window).getByText('hello.md')).toBeVisible();
    await expect(
      window.getByRole('heading', { name: path.basename(testProjectDir) })
    ).toBeVisible();
  });

  test('switches to another project when a different folder is opened', async ({
    electronApp,
    window,
    testProjectDir,
    nestedProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await expect(fileExplorer(window).getByText('hello.md')).toBeVisible();

    await openProjectFolder({
      electronApp,
      window,
      folderPath: nestedProjectDir,
    });

    // The explorer reflects the second project, and nothing of the first is left.
    await expect(fileExplorer(window).getByText('armadillo.md')).toBeVisible();
    await expect(fileExplorer(window).getByText('hello.md')).toBeHidden();
    await expect(
      window.getByRole('heading', { name: path.basename(nestedProjectDir) })
    ).toBeVisible();
  });
});
