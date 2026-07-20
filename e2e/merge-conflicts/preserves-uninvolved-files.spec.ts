import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  commitAllProjectChanges,
  commitChanges,
  createAndSwitchToBranch,
  mergeToMainBranch,
  openDocument,
  openProjectFolder,
  switchToBranch,
  typeInParagraphAndWaitForDebounce,
} from '../shared/helpers';

// Resolving a conflict may only change the files in conflict. Everything else
// in the project must come out of the merge exactly as it went in, so these
// fixtures are deliberately byte-sensitive: any content that is rewritten
// rather than copied shows up as a byte difference.

// Spans every possible byte value, so no byte-level transformation goes
// unnoticed.
const BINARY_WITH_EVERY_BYTE_VALUE = Buffer.from(
  Array.from({ length: 256 }, (_, i) => i)
);

// Carries a UTF-8 BOM, multibyte characters and CRLF line endings — the parts
// of a text file most often lost when it is read and written back.
const ENCODING_SENSITIVE_TEXT = Buffer.from(
  '﻿# Notes\r\n\r\nGreek: αβγδ\r\nCJK: 日本語\r\nEmoji: 🎉\r\n',
  'utf8'
);

const CONFLICTING_DOC = 'notes.md';
const UNINVOLVED_BINARY = 'assets/diagram.bin';
const UNINVOLVED_TEXT = 'reference/encoding.md';

const seedProject = (projectDir: string): void => {
  fs.writeFileSync(
    path.join(projectDir, CONFLICTING_DOC),
    '# Notes\n\nLorem ipsum dolor\n'
  );

  fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, UNINVOLVED_BINARY),
    BINARY_WITH_EVERY_BYTE_VALUE
  );

  fs.mkdirSync(path.join(projectDir, 'reference'), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, UNINVOLVED_TEXT),
    ENCODING_SENSITIVE_TEXT
  );
};

const editor = (window: Page) => window.locator('.ProseMirror');

// Diverges `notes.md` on two branches and merges them, leaving the project in
// the conflicted state with only that document in conflict.
const mergeWithConflict = async ({
  window,
  projectDir,
}: {
  window: Page;
  projectDir: string;
}): Promise<void> => {
  await openDocument({ window, relativePath: CONFLICTING_DOC });
  await expect(editor(window)).toContainText('Lorem ipsum dolor');

  // Commit the whole project, so the uninvolved files are tracked rather than
  // just the document being edited.
  await commitAllProjectChanges({ window, message: 'base commit' });

  await createAndSwitchToBranch({ window, branchName: 'experiment' });
  await expect(editor(window)).toContainText('Lorem ipsum dolor');
  await typeInParagraphAndWaitForDebounce({ window, text: ' on experiment' });
  await commitChanges({ window, message: 'experiment commit' });

  await switchToBranch({ window, from: 'experiment', to: 'main' });
  await expect(editor(window)).toContainText('Lorem ipsum dolor');
  await expect(editor(window)).not.toContainText('on experiment');
  await typeInParagraphAndWaitForDebounce({ window, text: ' on main' });
  await commitChanges({ window, message: 'main commit' });

  await switchToBranch({ window, to: 'experiment' });
  await expect(editor(window)).toContainText('on experiment');
  await mergeToMainBranch({ window, currentBranch: 'experiment' });

  // Wait until the project is actually in the conflicted state before reading
  // any files back.
  await expect(
    window.getByRole('heading', { name: 'Merge Conflicts', exact: true })
  ).toBeVisible({ timeout: 15_000 });

  expect(fs.existsSync(path.join(projectDir, CONFLICTING_DOC))).toBe(true);
};

test.describe('merge conflicts leave uninvolved files untouched', () => {
  test('a binary file is byte-identical after a conflicted merge', async ({
    electronApp,
    window,
    emptyProjectDir,
  }) => {
    seedProject(emptyProjectDir);
    await openProjectFolder({
      electronApp,
      window,
      folderPath: emptyProjectDir,
    });

    await mergeWithConflict({ window, projectDir: emptyProjectDir });

    const afterMerge = fs.readFileSync(
      path.join(emptyProjectDir, UNINVOLVED_BINARY)
    );

    // Compared as arrays so a failure reports the differing bytes rather than
    // just "buffers differ".
    expect(Array.from(afterMerge)).toEqual(
      Array.from(BINARY_WITH_EVERY_BYTE_VALUE)
    );
  });

  test('a text file keeps its BOM, encoding and line endings after a conflicted merge', async ({
    electronApp,
    window,
    emptyProjectDir,
  }) => {
    seedProject(emptyProjectDir);
    await openProjectFolder({
      electronApp,
      window,
      folderPath: emptyProjectDir,
    });

    await mergeWithConflict({ window, projectDir: emptyProjectDir });

    const afterMerge = fs.readFileSync(
      path.join(emptyProjectDir, UNINVOLVED_TEXT)
    );

    expect(afterMerge.subarray(0, 3).toString('hex')).toBe('efbbbf');
    expect(afterMerge.toString('utf8')).toContain('\r\n');
    expect(Array.from(afterMerge)).toEqual(Array.from(ENCODING_SENSITIVE_TEXT));
  });
});
