import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../../shared/fixtures';
import { hasCleanWorkingTree } from '../../shared/git';
import { openProjectFolder } from '../../shared/helpers';
import {
  createMergeConflictForPlainTextDocument,
  createMergeConflictForRichTextDocument,
  seedPlainTextDocument,
  seedRichTextDocument,
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
};

const expectPlainTextConflictScreen = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await expectConflictResolutionScreen({ window });
  await expect(window.locator('.cm-editor')).toBeVisible({ timeout: 15_000 });
  await expect(
    window.locator('.cm-editor .cm-mergeConflictMarker').first()
  ).toBeVisible();
};

const expectRichTextConflictScreen = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await expectConflictResolutionScreen({ window });

  // The preview renders only once a merged document is suggested.
  await expect(
    window.getByText(/This is a suggested merge preview/)
  ).toBeVisible({ timeout: 15_000 });
  await expect(window.locator('.ProseMirror')).toBeVisible();
};

test.describe('merge conflict resolution', () => {
  // The full flow drives many git + WASM operations; give it room.
  test.slow();

  test.describe('a conflict in a rich-text document', () => {
    test('shows a suggested merge for a document at the project root', async ({
      electronApp,
      window,
      emptyProjectDir,
    }) => {
      const relativePath = 'Bar.md';
      seedRichTextDocument({ projectDir: emptyProjectDir, relativePath });

      await openProjectFolder({
        electronApp,
        window,
        folderPath: emptyProjectDir,
      });

      await createMergeConflictForRichTextDocument({ window, relativePath });

      await expectRichTextConflictScreen({ window });
    });

    test('shows a suggested merge for a document in a nested folder', async ({
      electronApp,
      window,
      emptyProjectDir,
    }) => {
      const relativePath = path.join('Tech', 'Bar.md');
      seedRichTextDocument({ projectDir: emptyProjectDir, relativePath });

      await openProjectFolder({
        electronApp,
        window,
        folderPath: emptyProjectDir,
      });

      await createMergeConflictForRichTextDocument({ window, relativePath });

      await expectRichTextConflictScreen({ window });
    });
  });

  test.describe('a conflict in a plain-text document', () => {
    const name = 'config.yaml';
    const configPath = (projectDir: string) => path.join(projectDir, name);

    test('is resolved by keeping one side, once no markers remain', async ({
      electronApp,
      window,
      emptyProjectDir,
    }) => {
      seedPlainTextDocument({ projectDir: emptyProjectDir, name });
      await openProjectFolder({
        electronApp,
        window,
        folderPath: emptyProjectDir,
      });
      await createMergeConflictForPlainTextDocument({ window, name });
      await expectPlainTextConflictScreen({ window });

      const resolveButton = window.getByRole('button', {
        name: 'Resolve Conflict',
      });
      await expect(resolveButton).toBeDisabled();
      expect(fs.readFileSync(configPath(emptyProjectDir), 'utf8')).toBe(
        'name: v2\n<<<<<<< main\nversion: 1.29\n=======\nversion: 1.25\n>>>>>>> experiment\n'
      );

      await window.getByRole('button', { name: 'Keep experiment' }).click();
      await expect(window.locator('.cm-content')).toHaveText(
        'name: v2version: 1.25'
      );
      await resolveButton.click();

      await expect(
        window.getByText('The branch was merged successfully', { exact: false })
      ).toBeVisible({ timeout: 15_000 });
      expect(fs.readFileSync(configPath(emptyProjectDir), 'utf8')).toBe(
        'name: v2\nversion: 1.25\n'
      );
      expect(hasCleanWorkingTree({ repoDir: emptyProjectDir })).toBe(true);
    });

    test('aborting the merge leaves the file as it was on the branch merged into', async ({
      electronApp,
      window,
      emptyProjectDir,
    }) => {
      seedPlainTextDocument({ projectDir: emptyProjectDir, name });
      await openProjectFolder({
        electronApp,
        window,
        folderPath: emptyProjectDir,
      });
      await createMergeConflictForPlainTextDocument({ window, name });
      await expectPlainTextConflictScreen({ window });

      await window.getByRole('button', { name: 'Abort Merge' }).click();

      await expect
        .poll(() => fs.readFileSync(configPath(emptyProjectDir), 'utf8'))
        .toBe('name: v2\nversion: 1.29\n');
    });
  });
});
