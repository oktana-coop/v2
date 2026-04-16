import { expect, test } from './shared/fixtures';
import {
  openCommandPalette,
  openHelloMd,
  openProjectFolder,
} from './shared/helpers';

test('navigating to print preview via command palette renders the preview', async ({
  electronApp,
  window,
  testProjectDir,
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });

  await openCommandPalette({ window });

  const printPreviewOption = window.getByRole('option', {
    name: 'Print Preview',
  });
  await printPreviewOption.waitFor({ state: 'visible', timeout: 2_000 });
  await printPreviewOption.click();

  await expect(window).toHaveTitle(/Print Preview/i, { timeout: 2_000 });
  await expect(window.locator('iframe')).toBeVisible({ timeout: 5_000 });
});
