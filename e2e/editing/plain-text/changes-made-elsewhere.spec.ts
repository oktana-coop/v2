import fs from 'fs';
import path from 'path';

import { expect, test } from '../../shared/fixtures';
import {
  expectFileToContain,
  modKey,
  moveToEndOfFirstPlainTextLine,
  openPlainTextDocument,
  openProjectFolder,
  plainTextEditorLines,
} from '../../shared/helpers';

test.describe('an outside edit', () => {
  test('keeps the caret where it was', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const notesPath = path.join(testProjectDir, 'notes.txt');
    fs.writeFileSync(notesPath, 'first line\nsecond line\n');
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'notes.txt' });

    await moveToEndOfFirstPlainTextLine({ window });

    // Stands in for the user editing the file in another editor.
    fs.writeFileSync(notesPath, 'first line\nsecond line\nadded outside\n');
    await expect
      .poll(() => plainTextEditorLines({ window }).allTextContents(), {
        timeout: 5_000,
      })
      .toEqual(['first line', 'second line', 'added outside', '']);

    await window.keyboard.type(' typed');

    await expect
      .poll(() => plainTextEditorLines({ window }).allTextContents())
      .toEqual(['first line typed', 'second line', 'added outside', '']);
  });

  test("is not undone: undo reverts the user's own typing", async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const notesPath = path.join(testProjectDir, 'notes.txt');
    fs.writeFileSync(notesPath, 'first line\nsecond line\n');
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'notes.txt' });

    await moveToEndOfFirstPlainTextLine({ window });
    await window.keyboard.type(' mine');
    await expectFileToContain({ filePath: notesPath, text: 'first line mine' });

    fs.writeFileSync(
      notesPath,
      'first line mine\nsecond line\nadded outside\n'
    );
    await expect
      .poll(() => plainTextEditorLines({ window }).allTextContents(), {
        timeout: 5_000,
      })
      .toEqual(['first line mine', 'second line', 'added outside', '']);

    await window.keyboard.press(`${modKey}+z`);

    await expect
      .poll(() => plainTextEditorLines({ window }).allTextContents())
      .toEqual(['first line', 'second line', 'added outside', '']);
  });
});
