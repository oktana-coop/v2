import { expect, test } from './shared/fixtures';

test('app launches and shows main window', async ({ window }) => {
  await expect(window).toHaveTitle(/v2/i);
  await expect(window.locator('#root')).toBeVisible();
  await window.screenshot({ path: 'e2e-results/screenshots/startup.png' });
});
