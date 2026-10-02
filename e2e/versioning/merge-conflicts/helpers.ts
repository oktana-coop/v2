import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect } from '../../shared/fixtures';
import {
  commitChanges,
  createAndSwitchToBranch,
  mergeToMainBranch,
  openDocument,
  switchToBranch,
  typeInParagraphAndWaitForDebounce,
} from '../../shared/helpers';

const initialDocContent = '# Bar\n\nLorem ipsum dolor\n';

export const seedDocument = ({
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

export const createMergeConflictForDocument = async ({
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
