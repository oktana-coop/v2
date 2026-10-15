import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../../shared/fixtures';
import { openProjectFolder } from '../../shared/helpers';
import {
  createMergeConflictForDocument,
  createMergeConflictForPlainTextFile,
  seedDocument,
} from './helpers';

const expectConflictResolutionScreen = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  // Absent when the route fails to match.
  await expect(
    window.getByRole('heading', { name: 'Merge Conflicts', exact: true })
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    window.getByRole('heading', { name: /Resolving merge conflicts/ })
  ).toBeVisible();

  // The preview renders only once a merged document is suggested.
  await expect(
    window.getByText(/This is a suggested merge preview/)
  ).toBeVisible({ timeout: 15_000 });
};

test.describe('merge conflict resolution', () => {
  // The full flow drives many git + WASM operations; give it room.
  test.slow();

  test('resolves a content conflict for a document at the project root', async ({
    electronApp,
    window,
    emptyProjectDir,
  }) => {
    const relativePath = 'Bar.md';
    seedDocument({ projectDir: emptyProjectDir, relativePath });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: emptyProjectDir,
    });

    await createMergeConflictForDocument({ window, relativePath });

    await expectConflictResolutionScreen({ window });
  });

  test('resolves a content conflict for a document in a nested folder', async ({
    electronApp,
    window,
    emptyProjectDir,
  }) => {
    const relativePath = path.join('Tech', 'Bar.md');
    seedDocument({ projectDir: emptyProjectDir, relativePath });

    await openProjectFolder({
      electronApp,
      window,
      folderPath: emptyProjectDir,
    });

    await createMergeConflictForDocument({ window, relativePath });

    await expectConflictResolutionScreen({ window });
  });
});

test.describe('a conflict in a plain-text file', () => {
  test.slow();

  const configPath = (projectDir: string) =>
    path.join(projectDir, 'config.yaml');

  test('is shown as not supported yet, leaving the file as Git merged it', async ({
    electronApp,
    window,
    emptyProjectDir,
  }) => {
    fs.writeFileSync(configPath(emptyProjectDir), 'name: v2\nversion: 1.2\n');
    await openProjectFolder({
      electronApp,
      window,
      folderPath: emptyProjectDir,
    });

    await createMergeConflictForPlainTextFile({ window, name: 'config.yaml' });

    await expect(
      window.getByText(/can't resolve conflicts in plain-text files yet/)
    ).toBeVisible({ timeout: 15_000 });
    await expect(window.getByRole('button', { name: /resolve/i })).toHaveCount(
      0
    );
    expect(fs.readFileSync(configPath(emptyProjectDir), 'utf8')).toBe(
      'name: v2\n<<<<<<< main\nversion: 1.29\n=======\nversion: 1.25\n>>>>>>> experiment\n'
    );
  });

  test('aborting the merge leaves the file as it was on the branch merged into', async ({
    electronApp,
    window,
    emptyProjectDir,
  }) => {
    fs.writeFileSync(configPath(emptyProjectDir), 'name: v2\nversion: 1.2\n');
    await openProjectFolder({
      electronApp,
      window,
      folderPath: emptyProjectDir,
    });
    await createMergeConflictForPlainTextFile({ window, name: 'config.yaml' });
    await expect(
      window.getByText(/can't resolve conflicts in plain-text files yet/)
    ).toBeVisible({ timeout: 15_000 });

    await window.getByRole('button', { name: 'Abort Merge' }).click();

    await expect
      .poll(() => fs.readFileSync(configPath(emptyProjectDir), 'utf8'))
      .toBe('name: v2\nversion: 1.29\n');
  });
});
