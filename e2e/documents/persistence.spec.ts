import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  expectFileToContain,
  focusAndTypeInEditor,
  openHelloMd,
  openProjectFolder,
  returnToEditor,
  selectFirstCommit,
  typeInEditorAndWaitForDebounce,
} from '../shared/helpers';

test('disk write: typed content is saved to the .md file', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await focusAndTypeInEditor({ window, text: ' persisted' });

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
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
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
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
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
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
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
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
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

test('editing after a trip through history keeps every edit', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({
    window,
    text: ' hello',
    waitFor: 500,
  });

  // Leaving for the history view and back remounts the editor.
  await selectFirstCommit({ window, commitMessage: 'Set up versioning' });
  await expect(window.locator('.ProseMirror')).toBeVisible({ timeout: 2_000 });
  await returnToEditor({ window });

  await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
    'Hello hello',
    { timeout: 2_000 }
  );

  await focusAndTypeInEditor({ window, text: ' world' });

  await expectFileToContain({
    filePath: path.join(testProjectDir, 'hello.md'),
    text: 'Hello hello world',
  });
});
