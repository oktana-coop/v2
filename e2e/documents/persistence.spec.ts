import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  expectFileToContain,
  focusAndTypeInRichTextEditor,
  openHelloMd,
  openPlainTextDocument,
  openProjectFolder,
  plainTextEditor,
  plainTextEditorLines,
  returnToRichTextEditor,
  selectFirstCommit,
  typeAtEndOfPlainTextDocument,
  typeInEditorAndWaitForDebounce,
} from '../shared/helpers';

test.describe('a rich-text document', () => {
  test('disk write: typed content is saved to the .md file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await focusAndTypeInRichTextEditor({ window, text: ' persisted' });

    await expectFileToContain({
      filePath: path.join(testProjectDir, 'hello.md'),
      text: 'persisted',
    });
  });

  test('markdown round-trip: typed content survives a window reload', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    // Verify the markdown h1 renders as a heading in ProseMirror
    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello'
    );

    // Append to the heading
    await typeInEditorAndWaitForDebounce({
      window,
      text: ' roundtrip',
      waitFor: 700,
    });

    // Reload the window — forces a cold load from disk
    await window.reload();

    // Re-open the project and hello.md
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    // The heading with the appended text must survive the round-trip
    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello roundtrip'
    );
  });

  test('outside edit: changing the .md file shows up in the open editor', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello'
    );

    // Stands in for the user editing the file in another editor.
    fs.writeFileSync(
      path.join(testProjectDir, 'hello.md'),
      '# Hello from outside\n',
      'utf8'
    );

    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello from outside',
      { timeout: 5_000 }
    );
  });

  test('outside save through a temporary file shows up in the open editor', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello'
    );

    // Many editors save by writing a temporary file and renaming it over the
    // original.
    const temporaryPath = path.join(testProjectDir, '.hello.md.swp');
    fs.writeFileSync(temporaryPath, '# Hello saved elsewhere\n', 'utf8');
    fs.renameSync(temporaryPath, path.join(testProjectDir, 'hello.md'));

    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello saved elsewhere',
      { timeout: 5_000 }
    );
  });

  test('typing keeps the order of the front matter keys', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const helloPath = path.join(testProjectDir, 'hello.md');
    fs.writeFileSync(
      helloPath,
      '---\ntitle: Hello\ndate: 2025-09-04\nauthor: Ada\n---\n\n# Hello\n',
      'utf8'
    );
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await focusAndTypeInRichTextEditor({ window, text: ' world' });

    await expectFileToContain({
      filePath: helloPath,
      text: '---\ntitle: Hello\ndate: 2025-09-04\nauthor: Ada\n---\n\n# Hello world',
    });
  });

  test('outside edit: changed front matter is kept when typing afterwards', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const helloPath = path.join(testProjectDir, 'hello.md');
    fs.writeFileSync(helloPath, '---\ntitle: Hello\n---\n\n# Hello\n', 'utf8');
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello'
    );

    // Stands in for the user editing the file in another editor.
    fs.writeFileSync(
      helloPath,
      '---\ntitle: Changed outside\nstatus: draft\n---\n\n# Hello from outside\n',
      'utf8'
    );
    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello from outside',
      { timeout: 5_000 }
    );

    await focusAndTypeInRichTextEditor({ window, text: ' and inside' });

    await expectFileToContain({
      filePath: helloPath,
      text: '---\ntitle: Changed outside\nstatus: draft\n---\n\n# Hello from outside and inside',
    });
  });

  test('editing after a trip through history keeps every edit', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await typeInEditorAndWaitForDebounce({
      window,
      text: ' hello',
      waitFor: 500,
    });

    // Leaving for the history view and back remounts the editor.
    await selectFirstCommit({ window, commitMessage: 'Set up versioning' });
    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 2_000,
    });
    await returnToRichTextEditor({ window });

    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello hello',
      { timeout: 2_000 }
    );

    await focusAndTypeInRichTextEditor({ window, text: ' world' });

    await expectFileToContain({
      filePath: path.join(testProjectDir, 'hello.md'),
      text: 'Hello hello world',
    });
  });
});

test.describe('a plain-text document', () => {
  test('typed text is saved to the file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'config.json' });

    await typeAtEndOfPlainTextDocument({
      window,
      text: '{ "other": "value" }',
    });

    await expect
      .poll(() =>
        fs.readFileSync(path.join(testProjectDir, 'config.json'), 'utf8')
      )
      .toBe('{ "key": "value" }\n{ "other": "value" }');
  });

  test('a file with Windows line endings keeps them when edited', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    fs.writeFileSync(
      path.join(testProjectDir, 'notes.txt'),
      'first line\r\nsecond line\r\n'
    );
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'notes.txt' });

    await typeAtEndOfPlainTextDocument({ window, text: 'third line' });

    await expect
      .poll(() =>
        fs.readFileSync(path.join(testProjectDir, 'notes.txt'), 'utf8')
      )
      .toBe('first line\r\nsecond line\r\nthird line');
  });

  test('outside edit: changing the file shows up in the open editor', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'config.json' });
    await expect(plainTextEditor({ window })).toContainText('"key"');

    // Stands in for the user editing the file in another editor.
    fs.writeFileSync(
      path.join(testProjectDir, 'config.json'),
      '{ "key": "changed outside" }\n'
    );

    await expect
      .poll(() => plainTextEditorLines({ window }).allTextContents(), {
        timeout: 5_000,
      })
      .toEqual(['{ "key": "changed outside" }', '']);
  });
});
