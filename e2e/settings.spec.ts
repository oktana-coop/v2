import { expect, test } from './shared/fixtures';
import { clickSettingsTab, navigateToSettings } from './shared/helpers';

test.describe('settings page', () => {
  test('navigating to settings defaults to General tab', async ({ window }) => {
    await navigateToSettings({ window });

    await expect(window).toHaveTitle(/General Settings/i);
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

    await expect(window).toHaveTitle(/Sync Settings/i);
    await expect(window.getByText('Sync Providers')).toBeVisible();
  });

  test('Appearance tab shows theme section', async ({ window }) => {
    await navigateToSettings({ window });
    await clickSettingsTab({ window, tabName: 'Appearance' });

    await expect(window).toHaveTitle(/Appearance Settings/i);
    await expect(window.getByText('Theme')).toBeVisible();
    await expect(window.getByLabel('Light')).toBeVisible();
    await expect(window.getByLabel('Dark')).toBeVisible();
  });

  test('switching between tabs updates breadcrumb', async ({ window }) => {
    await navigateToSettings({ window });

    await expect(window).toHaveTitle(/General Settings/i);

    await clickSettingsTab({ window, tabName: 'Sync' });
    await expect(window).toHaveTitle(/Sync Settings/i);

    await clickSettingsTab({ window, tabName: 'Appearance' });
    await expect(window).toHaveTitle(/Appearance Settings/i);

    await clickSettingsTab({ window, tabName: 'General' });
    await expect(window).toHaveTitle(/General Settings/i);
  });

  test('Exports tab shows export templates section', async ({ window }) => {
    await navigateToSettings({ window });
    await clickSettingsTab({ window, tabName: 'Exports' });

    await expect(window).toHaveTitle(/Export Templates/i);
    await expect(
      window.getByRole('heading', { name: 'Export Templates' })
    ).toBeVisible();
    await expect(
      window.getByRole('button', { name: /new template/i })
    ).toBeVisible();
  });

  test('Exports tab shows default template in listbox', async ({ window }) => {
    await navigateToSettings({ window });
    await clickSettingsTab({ window, tabName: 'Exports' });

    await expect(window.getByText('Default Template')).toBeVisible();
  });
});
