import { expect, test } from '../../shared/fixtures';
import {
  modKey,
  openPlainTextDocument,
  openProjectFolder,
  plainTextEditor,
} from '../../shared/helpers';

test('finds text through the search panel', async ({
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

  await plainTextEditor({ window }).click();
  await window.keyboard.press(`${modKey}+f`);
  await expect(window.locator('.cm-search')).toBeVisible();
  await window.keyboard.type('value');

  await expect(window.locator('.cm-searchMatch')).toHaveCount(1);
});
