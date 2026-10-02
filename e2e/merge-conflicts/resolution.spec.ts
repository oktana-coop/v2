import { Page } from '@playwright/test';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import { openProjectFolder } from '../shared/helpers';
import { createMergeConflictForDocument, seedDocument } from './helpers';

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
