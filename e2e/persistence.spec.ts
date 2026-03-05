import fs from 'fs';
import path from 'path';

import { expect, test } from './fixtures';
import { openHelloMd, openProjectFolder } from './helpers';

test('disk write: typed content is saved to the .md file', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  const editor = window.locator('.ProseMirror');
  await editor.click();
  await window.keyboard.press('End');
  await window.keyboard.type(' persisted');

  // Wait for the 300 ms auto-save debounce to flush
  await window.waitForTimeout(500);

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
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  // Verify the markdown h1 renders as a heading in ProseMirror
  await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
    'Hello'
  );

  // Append to the heading
  await window.locator('.ProseMirror h1').click();
  await window.keyboard.press('End');
  await window.keyboard.type(' roundtrip');

  // Wait for the 300 ms auto-save debounce to flush
  await window.waitForTimeout(500);

  // Reload the window — forces a cold load from disk
  await window.reload();

  // Re-open the project and hello.md
  await openProjectFolder(electronApp, window, testProjectDir);
  await openHelloMd(window);

  // The heading with the appended text must survive the round-trip
  await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
    'Hello roundtrip'
  );
});

test('git auto-init: opening a plain folder creates a .git directory', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  // testProjectDir is created with mkdtempSync — no .git initially
  expect(fs.existsSync(path.join(testProjectDir, '.git'))).toBe(false);

  await openProjectFolder(electronApp, window, testProjectDir);

  // Wait for git to initialise the repo
  await window.waitForTimeout(500);

  expect(fs.existsSync(path.join(testProjectDir, '.git'))).toBe(true);
});
