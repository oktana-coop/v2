import fs from 'fs';
import path from 'path';

import { expect, test } from '../../shared/fixtures';
import {
  documentStartKey,
  moveToEndOfFirstPlainTextLine,
  openPlainTextDocument,
  openProjectFolder,
  plainTextEditor,
  plainTextEditorLines,
} from '../../shared/helpers';

test('Tab at the end of a line indents there, not at the start of the line', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  fs.writeFileSync(path.join(testProjectDir, 'notes.txt'), 'first line\n');
  await openProjectFolder({
    electronApp,
    window,
    folderPath: testProjectDir,
  });
  await openPlainTextDocument({ window, name: 'notes.txt' });

  await moveToEndOfFirstPlainTextLine({ window });
  await window.keyboard.press('Tab');
  await window.keyboard.type('after');

  await expect
    .poll(() => plainTextEditorLines({ window }).allTextContents())
    .toEqual(['first line  after', '']);
});

test('Tab with lines selected indents them', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  fs.writeFileSync(
    path.join(testProjectDir, 'notes.txt'),
    'first line\nsecond line\n'
  );
  await openProjectFolder({
    electronApp,
    window,
    folderPath: testProjectDir,
  });
  await openPlainTextDocument({ window, name: 'notes.txt' });

  await plainTextEditor({ window }).click();
  await window.keyboard.press(documentStartKey);
  await window.keyboard.press('Shift+ArrowDown');
  await window.keyboard.press('Shift+ArrowRight');
  await window.keyboard.press('Tab');

  await expect
    .poll(() => plainTextEditorLines({ window }).allTextContents())
    .toEqual(['  first line', '  second line', '']);
});
