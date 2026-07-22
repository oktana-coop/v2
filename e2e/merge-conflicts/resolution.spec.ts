import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  commitChanges,
  createAndSwitchToBranch,
  mergeToMainBranch,
  openDocument,
  openProjectFolder,
  switchToBranch,
  typeInParagraphAndWaitForDebounce,
} from '../shared/helpers';

const initialDocContent = '# Bar\n\nLorem ipsum dolor\n';

const seedDocument = ({
  projectDir,
  relativePath,
}: {
  projectDir: string;
  relativePath: string;
}): void => {
  const fullPath = path.join(projectDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, initialDocContent);
};

const editor = (window: Page) => window.locator('.ProseMirror');

const createMergeConflictForDocument = async ({
  window,
  relativePath,
}: {
  window: Page;
  relativePath: string;
}): Promise<void> => {
  await openDocument({ window, relativePath });

  await expect(editor(window)).toContainText('Lorem ipsum dolor');

  await createAndSwitchToBranch({ window, branchName: 'experiment' });
  await expect(editor(window)).toContainText('Lorem ipsum dolor');
  await typeInParagraphAndWaitForDebounce({ window, text: ' on experiment' });
  await commitChanges({ window, message: 'experiment commit' });

  await switchToBranch({ window, from: 'experiment', to: 'main' });
  // Wait for main's content to reload before editing.
  await expect(editor(window)).toContainText('Lorem ipsum dolor');
  await expect(editor(window)).not.toContainText('on experiment');
  await typeInParagraphAndWaitForDebounce({ window, text: ' on main' });
  await commitChanges({ window, message: 'main commit' });

  await switchToBranch({ window, to: 'experiment' });
  await expect(editor(window)).toContainText('on experiment');
  await mergeToMainBranch({ window, currentBranch: 'experiment' });
};

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
