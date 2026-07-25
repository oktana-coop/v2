import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  openHelloMd,
  openProjectFolder,
  returnToEditor,
  selectFirstCommit,
  typeInEditorAndWaitForDebounce,
} from '../shared/helpers';

// The editor used to render from a snapshot taken when the document was opened.
// Remounting (returning from history) replayed that stale snapshot, and the next
// keystroke persisted it over the newer file — silently losing the edits between.
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

  await typeInEditorAndWaitForDebounce({
    window,
    text: ' world',
    waitFor: 500,
  });

  const content = fs.readFileSync(
    path.join(testProjectDir, 'hello.md'),
    'utf8'
  );
  expect(content).toContain('Hello hello world');

  // Reopening from disk must show both edits, not just the last one.
  await window.reload();
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
    'Hello hello world',
    { timeout: 2_000 }
  );
});
