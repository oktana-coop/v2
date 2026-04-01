import { type Page } from '@playwright/test';

import { expect, test } from './shared/fixtures';

const navigateToSettings = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await window
    .getByTestId('nav-bar')
    .getByRole('link', { name: /options/i })
    .click();
  await expect(window).toHaveTitle(/settings/i, { timeout: 2_000 });
};

const clickSettingsTab = async ({
  window,
  tabName,
}: {
  window: Page;
  tabName: string;
}): Promise<void> => {
  await window.getByRole('link', { name: tabName, exact: true }).click();
};

test.describe('settings page', () => {
  test('navigating to settings defaults to General tab', async ({ window }) => {
    await navigateToSettings({ window });

    await expect(window).toHaveTitle(/Settings \/ General/i);
    await expect(window.getByText('Author Info')).toBeVisible();
  });

  test('General tab shows author info fields', async ({ window }) => {
    await navigateToSettings({ window });

    await expect(window.getByText('Author Info')).toBeVisible();
    await expect(window.getByRole('textbox', { name: 'Name' })).toBeVisible();
    await expect(window.getByRole('textbox', { name: 'Email' })).toBeVisible();
  });

  test('Sync tab shows sync providers section', async ({ window }) => {
    await navigateToSettings({ window });
    await clickSettingsTab({ window, tabName: 'Sync' });

    await expect(window).toHaveTitle(/Settings \/ Sync/i);
    await expect(window.getByText('Sync Providers')).toBeVisible();
  });

  test('Appearance tab shows theme section', async ({ window }) => {
    await navigateToSettings({ window });
    await clickSettingsTab({ window, tabName: 'Appearance' });

    await expect(window).toHaveTitle(/Settings \/ Appearance/i);
    await expect(window.getByText('Theme')).toBeVisible();
    await expect(window.getByLabel('Light')).toBeVisible();
    await expect(window.getByLabel('Dark')).toBeVisible();
  });

  test('switching between tabs updates breadcrumb', async ({ window }) => {
    await navigateToSettings({ window });

    await expect(window).toHaveTitle(/Settings \/ General/i);

    await clickSettingsTab({ window, tabName: 'Sync' });
    await expect(window).toHaveTitle(/Settings \/ Sync/i);

    await clickSettingsTab({ window, tabName: 'Appearance' });
    await expect(window).toHaveTitle(/Settings \/ Appearance/i);

    await clickSettingsTab({ window, tabName: 'General' });
    await expect(window).toHaveTitle(/Settings \/ General/i);
  });
});
