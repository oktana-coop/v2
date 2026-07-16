import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  openHelloMd,
  openProjectFolder,
  typeInEditorAndWaitForDebounce,
} from '../shared/helpers';

test('disk write: typed content is saved to the .md file', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await typeInEditorAndWaitForDebounce({
    window,
    text: ' persisted',
    waitFor: 600,
  });

  const content = fs.readFileSync(
    path.join(testProjectDir, 'hello.md'),
    'utf8'
  );
  expect(content).toContain('persisted');
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
