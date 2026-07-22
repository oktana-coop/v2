import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  commitMessages,
  hasCleanWorkingTree,
  initRepositoryWithCommit,
  lastCommitAuthor,
  trackedFiles,
} from '../shared/git';
import { openDocument, openProjectFolder } from '../shared/helpers';

const fileExplorer = (window: Parameters<typeof openDocument>[0]['window']) =>
  window.getByTestId('file-explorer');

test.describe('project opening', () => {
  test('.git missing, folder empty: commits just the generated .gitignore', async ({
    electronApp,
    window,
    emptyProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: emptyProjectDir,
    });

    await expect
      .poll(() => commitMessages({ repoDir: emptyProjectDir }), {
        timeout: 5_000,
      })
      .toEqual(['Set up versioning']);

    expect(trackedFiles({ repoDir: emptyProjectDir })).toEqual(['.gitignore']);
    expect(hasCleanWorkingTree({ repoDir: emptyProjectDir })).toBe(true);
  });

  test('.git missing, .gitignore missing: initialises and commits the folder as found', async ({
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

    // Reading the log at all proves the repo was initialised.
    await expect
      .poll(() => commitMessages({ repoDir: testProjectDir }), {
        timeout: 5_000,
      })
      .toEqual(['Set up versioning']);

    // Everything the folder came with, plus the generated gitignore, is in the
    // snapshot — nothing is left dangling as an uncommitted change.
    expect(trackedFiles({ repoDir: testProjectDir })).toEqual([
      '.gitignore',
      'config.json',
      'hello.md',
      'world.md',
    ]);
    expect(hasCleanWorkingTree({ repoDir: testProjectDir })).toBe(true);
    expect(lastCommitAuthor({ repoDir: testProjectDir })).toBe(
      'v2 Bot <bot@v2editor.com>'
    );
  });

  test('.git missing, .gitignore present: keeps it and honours its rules', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const existingGitignore = '# mine\nconfig.json\n';
    fs.writeFileSync(
      path.join(testProjectDir, '.gitignore'),
      existingGitignore
    );

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    await expect
      .poll(() => commitMessages({ repoDir: testProjectDir }), {
        timeout: 5_000,
      })
      .toEqual(['Set up versioning']);

    expect(
      fs.readFileSync(path.join(testProjectDir, '.gitignore'), 'utf8')
    ).toBe(existingGitignore);
    // Their rules govern the snapshot: config.json is excluded by them.
    expect(trackedFiles({ repoDir: testProjectDir })).toEqual([
      '.gitignore',
      'hello.md',
      'world.md',
    ]);
  });

  test('.git present: nothing is created', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    initRepositoryWithCommit({
      repoDir: testProjectDir,
      message: 'their own commit',
    });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await expect(fileExplorer(window).getByText('hello.md')).toBeVisible();

    expect(commitMessages({ repoDir: testProjectDir })).toEqual([
      'their own commit',
    ]);
    expect(fs.existsSync(path.join(testProjectDir, '.gitignore'))).toBe(false);
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
