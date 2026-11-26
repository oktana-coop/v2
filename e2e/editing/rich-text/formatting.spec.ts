import { Page } from '@playwright/test';

import { expect, test } from '../../shared/fixtures';
import {
  clearRichTextEditor,
  clickToolbarButton,
  focusAndTypeInRichTextEditor,
  modKey,
  openEditorToolbar,
} from '../../shared/helpers';
import { setupEditor } from './helpers';

test.describe('toolbar interactions', () => {
  // TODO: clicking `.ProseMirror p` directly doesn't move the ProseMirror
  // cursor into the paragraph — it stays at the beginning of the document.
  // Using ArrowDown as a workaround until we understand why.
  const focusParagraph = async (window: Page) => {
    await window.locator('.ProseMirror').click();
    await window.keyboard.press('ArrowDown');
  };

  test('bold button makes text bold', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    await focusParagraph(window);
    await window.keyboard.press('Home');
    await window.keyboard.press('Shift+End');

    await clickToolbarButton({ window, label: 'Bold' });

    await expect(window.locator('.ProseMirror p strong')).toContainText(
      'This is a test document.'
    );
  });

  test('italic button makes text italic', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    await focusParagraph(window);
    await window.keyboard.press('Home');
    await window.keyboard.press('Shift+End');

    await clickToolbarButton({ window, label: 'Italics' });

    await expect(window.locator('.ProseMirror p em')).toContainText(
      'This is a test document.'
    );
  });

  test('inline code button makes text code', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    await focusParagraph(window);
    await window.keyboard.press('Home');
    await window.keyboard.press('Shift+End');

    await clickToolbarButton({ window, label: 'Inline Code' });

    await expect(window.locator('.ProseMirror p code')).toContainText(
      'This is a test document.'
    );
  });

  test('BlockSelect changes to Heading 1', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    await focusParagraph(window);

    await window.locator('[data-slot="control"]').click();
    await window.getByRole('option', { name: 'Heading 1' }).click();

    await expect(window.locator('.ProseMirror h1')).toHaveCount(2);
    await expect(window.locator('.ProseMirror h1').last()).toContainText(
      'This is a test document.'
    );
  });

  test('BlockSelect changes to Code Block', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    await focusParagraph(window);

    await window.locator('[data-slot="control"]').click();
    await window.getByRole('option', { name: 'Code Block' }).click();

    await expect(window.locator('.ProseMirror pre')).toContainText(
      'This is a test document.'
    );
  });

  test('bullet list button wraps in bullet list', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    await focusParagraph(window);
    await clickToolbarButton({ window, label: 'Bullet List' });

    await expect(window.locator('.ProseMirror ul')).toContainText(
      'This is a test document.'
    );
  });

  test('ordered list button wraps in ordered list', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    await focusParagraph(window);
    await clickToolbarButton({ window, label: 'Ordered List' });

    await expect(window.locator('.ProseMirror ol')).toContainText(
      'This is a test document.'
    );
  });

  test('quote button wraps in blockquote', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    await focusParagraph(window);
    await clickToolbarButton({ window, label: 'Quote' });

    await expect(window.locator('.ProseMirror blockquote')).toContainText(
      'This is a test document.'
    );
  });
});

test.describe('keyboard shortcuts', () => {
  test('Cmd+B toggles bold', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: 'bold text' });
    await window.keyboard.press(`${modKey}+a`);
    await window.keyboard.press(`${modKey}+b`);

    await expect(window.locator('.ProseMirror strong')).toContainText(
      'bold text'
    );

    // Toggle off
    await window.keyboard.press(`${modKey}+b`);
    await expect(window.locator('.ProseMirror strong')).toHaveCount(0);
    await expect(window.locator('.ProseMirror')).toContainText('bold text');
  });

  test('Cmd+I toggles italic', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: 'italic text' });
    await window.keyboard.press(`${modKey}+a`);
    await window.keyboard.press(`${modKey}+i`);

    await expect(window.locator('.ProseMirror em')).toContainText(
      'italic text'
    );

    // Toggle off
    await window.keyboard.press(`${modKey}+i`);
    await expect(window.locator('.ProseMirror em')).toHaveCount(0);
    await expect(window.locator('.ProseMirror')).toContainText('italic text');
  });
});
