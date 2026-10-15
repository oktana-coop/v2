import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect } from '../../shared/fixtures';
import {
  commitChanges,
  createAndSwitchToBranch,
  lineEndKey,
  mergeToMainBranch,
  moveToEndOfFirstPlainTextLine,
  openPlainTextDocument,
  openRichTextDocument,
  plainTextEditorLines,
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
  await openRichTextDocument({ window, relativePath });

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

// Both branches change the second line of a two-line YAML file, `main` to
// `version: 1.29` and `experiment` to `version: 1.25`, then `experiment` is
// merged into `main`.
export const createMergeConflictForPlainTextFile = async ({
  window,
  name,
}: {
  window: Page;
  name: string;
}): Promise<void> => {
  const appendToSecondLine = async (text: string) => {
    await moveToEndOfFirstPlainTextLine({ window });
    await window.keyboard.press('ArrowDown');
    await window.keyboard.press(lineEndKey);
    await window.keyboard.type(text);
  };

  await openPlainTextDocument({ window, name });

  await createAndSwitchToBranch({ window, branchName: 'experiment' });
  await appendToSecondLine('5');
  await commitChanges({ window, message: 'experiment commit' });

  await switchToBranch({ window, from: 'experiment', to: 'main' });
  // Wait for main's content to reload before editing.
  await expect
    .poll(() => plainTextEditorLines({ window }).allTextContents())
    .toContain('version: 1.2');
  await appendToSecondLine('9');
  await commitChanges({ window, message: 'main commit' });

  await switchToBranch({ window, to: 'experiment' });
  await mergeToMainBranch({ window, currentBranch: 'experiment' });
};
