import { expect, test } from './shared/fixtures';
import { clickSettingsTab, navigateToSettings } from './shared/helpers';

const navigateToExports = async ({
  window,
}: {
  window: Parameters<typeof navigateToSettings>[0]['window'];
}): Promise<void> => {
  await navigateToSettings({ window });
  await clickSettingsTab({ window, tabName: 'Exports' });
  await expect(window).toHaveTitle(/Export Templates/i);
};

test.describe('export templates', () => {
  test('creating a new template navigates to the template editor', async ({
    window,
  }) => {
    await navigateToExports({ window });

    await window.getByRole('button', { name: /new template/i }).click();

    // Should navigate to the template editor with the new template name in the breadcrumb
    await expect(window).toHaveTitle(/New Template/i, { timeout: 2_000 });
    await expect(
      window.getByRole('button', { name: /rename template/i })
    ).toBeVisible();
  });

  test('template editor shows preview and style controls', async ({
    window,
  }) => {
    await navigateToExports({ window });
    await window.getByRole('button', { name: /new template/i }).click();
    await expect(window).toHaveTitle(/New Template/i, { timeout: 2_000 });

    // Preview iframe should be present
    await expect(window.locator('iframe')).toBeVisible({ timeout: 3_000 });

    // Style controls panel should show section headings and expansion panels
    await expect(
      window.getByRole('heading', { name: 'Page Setup' })
    ).toBeVisible();
    await expect(
      window.getByRole('button', { name: 'Paragraph' })
    ).toBeVisible();
  });

  test('renaming a template updates the breadcrumb', async ({ window }) => {
    await navigateToExports({ window });
    await window.getByRole('button', { name: /new template/i }).click();
    await expect(window).toHaveTitle(/New Template/i, { timeout: 2_000 });

    // Click the rename (pen) icon button
    await window.getByRole('button', { name: /rename template/i }).click();

    // Fill in the new name in the rename dialog
    const input = window.getByRole('textbox', { name: 'Name' });
    await input.waitFor({ state: 'visible', timeout: 1_000 });
    await input.fill('My Custom Template');

    // Submit the rename
    await window.getByRole('button', { name: /^Rename$/i }).click();

    // Breadcrumb and title should update
    await expect(window).toHaveTitle(/My Custom Template/i, { timeout: 2_000 });
    await expect(
      window.locator('nav').getByText('My Custom Template')
    ).toBeVisible();
  });

  test('navigating back to exports list shows created template', async ({
    window,
  }) => {
    await navigateToExports({ window });
    await window.getByRole('button', { name: /new template/i }).click();
    await expect(window).toHaveTitle(/New Template/i, { timeout: 2_000 });

    // Navigate back to the exports list via the breadcrumb (not the sidebar nav)
    await window
      .locator('nav')
      .filter({ has: window.getByRole('link', { name: 'Settings' }) })
      .getByRole('link', { name: 'Exports' })
      .click();
    await expect(window).toHaveTitle(/Export Templates/i, { timeout: 2_000 });

    // Open the listbox to see all templates
    await window.locator('[data-slot="control"]').click();
    const listbox = window.locator('[role="listbox"]');

    // Both the default and the new template should be listed
    await expect(listbox.getByText('Default Template')).toBeVisible();
    await expect(listbox.getByText('New Template').first()).toBeVisible();
  });

  test('deleting a template removes it from the list', async ({ window }) => {
    await navigateToExports({ window });

    // Create a template first
    await window.getByRole('button', { name: /new template/i }).click();
    await expect(window).toHaveTitle(/New Template/i, { timeout: 2_000 });

    // Go back to list via breadcrumb
    await window
      .locator('nav')
      .filter({ has: window.getByRole('link', { name: 'Settings' }) })
      .getByRole('link', { name: 'Exports' })
      .click();
    await expect(window).toHaveTitle(/Export Templates/i, { timeout: 2_000 });

    // Open the listbox and count templates before deletion
    await window.locator('[data-slot="control"]').click();
    const listbox = window.locator('[role="listbox"]');
    const countBefore = await listbox.getByRole('option').count();

    // Focus the last option (the newly created template) and click delete
    const newTemplateOption = listbox.getByText('New Template').first();
    await newTemplateOption.hover();
    // The delete button (trash icon) is the last button in the option row
    const optionRow = listbox
      .getByRole('option')
      .filter({ hasText: 'New Template' })
      .first();
    await optionRow.locator('span[role="button"], button').last().click();

    // Re-open the listbox and verify there is one fewer option
    await window.locator('[data-slot="control"]').click();
    const countAfter = await listbox.getByRole('option').count();
    expect(countAfter).toBe(countBefore - 1);
  });

  test('default template cannot be deleted', async ({ window }) => {
    await navigateToExports({ window });

    // Open the listbox
    await window.locator('[data-slot="control"]').click();
    const listbox = window.locator('[role="listbox"]');

    // Focus the default template option
    const defaultOption = listbox
      .getByRole('option')
      .filter({ hasText: 'Default Template' })
      .first();
    await defaultOption.hover();

    // The default template should only have an edit button (pen), no delete button (trash)
    // The TemplateOptionActions renders 1 button for default (edit only) vs 2 for custom (edit + delete)
    const buttons = defaultOption.getByRole('button');
    await expect(buttons).toHaveCount(1);
  });
});

test.describe('match export template', () => {
  test('checking "Match export template" disables font controls', async ({
    window,
  }) => {
    await navigateToSettings({ window });
    await clickSettingsTab({ window, tabName: 'Appearance' });
    await expect(window).toHaveTitle(/Appearance Settings/i);

    // Check the "Match export template" checkbox
    const checkbox = window.getByLabel('Match export template');
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // The font controls container should be disabled
    const fontControls = window
      .locator('[aria-disabled="true"]')
      .filter({ hasText: 'Heading Font' });
    await expect(fontControls).toBeVisible();
  });

  test('unchecking "Match export template" re-enables font controls', async ({
    window,
  }) => {
    await navigateToSettings({ window });
    await clickSettingsTab({ window, tabName: 'Appearance' });

    const checkbox = window.getByLabel('Match export template');

    // Check then uncheck
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    // The font controls container should no longer be disabled
    const fontControls = window
      .locator('[aria-disabled="true"]')
      .filter({ hasText: 'Heading Font' });
    await expect(fontControls).toBeHidden();
  });
});
