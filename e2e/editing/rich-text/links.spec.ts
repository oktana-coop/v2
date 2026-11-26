import { expect, test } from '../../shared/fixtures';
import {
  clearRichTextEditor,
  clickToolbarButton,
  getRichTextEditorHTML,
  modKey,
  openEditorToolbar,
  typeInEditorAndWaitForDebounce,
} from '../../shared/helpers';
import { setupEditor } from './helpers';

test.describe('links', () => {
  // Helper to create a link using keyboard shortcut (avoids toolbar state issues)
  const createLinkViaKeyboard = async ({
    window,
    text,
    href,
  }: {
    window: Parameters<typeof clearRichTextEditor>[0]['window'];
    text: string;
    href: string;
  }) => {
    await typeInEditorAndWaitForDebounce({ window, text });
    await window.keyboard.press('Home');
    await window.keyboard.press('Shift+End');
    await window.keyboard.press(`${modKey}+Shift+l`);

    const titleInput = window.locator('input[name="title"]');
    await titleInput.waitFor({ state: 'visible', timeout: 2_000 });
    await titleInput.fill(text);

    const hrefInput = window.locator('input[name="href"]');
    await hrefInput.fill(href);
    await window.getByRole('button', { name: 'Save' }).click();

    // Wait for dialog to close
    await titleInput.waitFor({ state: 'hidden', timeout: 1_000 });
  };

  test('toolbar: create link via dialog', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    await window.locator('.ProseMirror p').first().click();
    await window.keyboard.press('Home');
    await window.keyboard.press('Shift+End');
    await clickToolbarButton({ window, label: 'Link' });

    // Fill in the link dialog
    const titleInput = window.locator('input[name="title"]');
    await titleInput.waitFor({ state: 'visible', timeout: 2_000 });
    // Title may be pre-filled with selected text; fill href
    const hrefInput = window.locator('input[name="href"]');
    await hrefInput.fill('https://example.com');

    await window.getByRole('button', { name: 'Save' }).click();

    await expect(window.locator('.ProseMirror a').first()).toBeVisible();
  });

  test('keyboard shortcut: Cmd+Shift+L opens link dialog', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await createLinkViaKeyboard({
      window,
      text: 'link text',
      href: 'https://example.com',
    });

    await expect(window.locator('.ProseMirror a')).toContainText('link text');
  });

  test('link popover appears on click', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await createLinkViaKeyboard({
      window,
      text: 'my link',
      href: 'https://example.com',
    });

    // Click on the link to open popover
    await window.locator('.ProseMirror a').click();

    // Popover should show the link details
    const popover = window.locator('#popover-container');
    await expect(popover.getByText('https://example.com')).toBeVisible({
      timeout: 2_000,
    });
  });

  test('edit link from popover', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await createLinkViaKeyboard({
      window,
      text: 'my link',
      href: 'https://example.com',
    });

    // Click on the link to open popover
    await window.locator('.ProseMirror a').click();
    await window.waitForTimeout(300);

    // Click Edit in the popover
    const popover = window.locator('#popover-container');
    await popover.getByRole('button', { name: 'Edit' }).click();

    // Update the href
    const editHrefInput = window.locator('input[name="href"]');
    await editHrefInput.waitFor({ state: 'visible', timeout: 2_000 });
    await editHrefInput.fill('https://updated.com');
    await window.getByRole('button', { name: 'Save' }).click();

    // Verify updated link
    const html = await getRichTextEditorHTML({ window });
    expect(html).toContain('https://updated.com');
  });

  test('remove link from popover', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await createLinkViaKeyboard({
      window,
      text: 'my link',
      href: 'https://example.com',
    });

    await expect(window.locator('.ProseMirror a')).toHaveCount(1);

    // Click on the link to open popover
    await window.locator('.ProseMirror a').click();
    await window.waitForTimeout(300);

    // Click Remove in the popover
    const popover = window.locator('#popover-container');
    await popover.getByRole('button', { name: 'Remove' }).click();

    // Link mark should be removed but text should remain
    await expect(window.locator('.ProseMirror a')).toHaveCount(0);
    await expect(window.locator('.ProseMirror')).toContainText('my link');
  });
});
