import { Page } from '@playwright/test';

import { expect, test } from './shared/fixtures';
import {
  clearEditor,
  clickToolbarButton,
  getEditorHTML,
  modKey,
  openEditorToolbar,
  openHelloMd,
  openProjectFolder,
  pasteMarkdown,
  typeInEditor,
  typeInEditorAndWaitForDebounce,
  typeInEditorSlowly,
} from './shared/helpers';

const setupEditor = async ({
  electronApp,
  window,
  testProjectDir,
}: {
  electronApp: Parameters<typeof openProjectFolder>[0]['electronApp'];
  window: Parameters<typeof openProjectFolder>[0]['window'];
  testProjectDir: string;
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });
};

test.describe('typing', () => {
  test('types text character by character with delay', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditorSlowly({ window, text: 'Hello World', delay: 30 });

    const editor = window.locator('.ProseMirror');
    await expect(editor).toContainText('Hello World');
  });

  test('types multiple paragraphs', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: 'First paragraph' });
    await window.keyboard.press('Enter');
    await typeInEditor({ window, text: 'Second paragraph' });
    await window.keyboard.press('Enter');
    await typeInEditor({ window, text: 'Third paragraph' });

    const paragraphs = window.locator('.ProseMirror p');
    await expect(paragraphs).toHaveCount(3);
  });
});

test.describe('markdown input rules', () => {
  test('# creates h1 heading', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: '# Heading One' });

    await expect(window.locator('.ProseMirror h1')).toContainText(
      'Heading One'
    );
  });

  test('## creates h2 heading', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: '## Heading Two' });

    await expect(window.locator('.ProseMirror h2')).toContainText(
      'Heading Two'
    );
  });

  test('### creates h3 heading', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: '### Heading Three' });

    await expect(window.locator('.ProseMirror h3')).toContainText(
      'Heading Three'
    );
  });

  test('> creates blockquote', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: '> Quoted text' });

    await expect(window.locator('.ProseMirror blockquote')).toContainText(
      'Quoted text'
    );
  });

  test('``` creates code block', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: '```' });
    await window.keyboard.press('Enter');

    await expect(window.locator('.ProseMirror pre')).toBeVisible();
  });

  test('- creates bullet list', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: '- List item' });

    await expect(window.locator('.ProseMirror ul')).toContainText('List item');
  });

  test('1. creates ordered list', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: '1. First item' });

    await expect(window.locator('.ProseMirror ol')).toContainText('First item');
  });

  test('**text** creates bold', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditorSlowly({ window, text: '**bold text**', delay: 20 });

    await expect(window.locator('.ProseMirror strong')).toContainText(
      'bold text'
    );
  });

  test('*text* creates italic', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditorSlowly({ window, text: '*italic text*', delay: 20 });

    await expect(window.locator('.ProseMirror em')).toContainText(
      'italic text'
    );
  });

  test('`text` creates inline code', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditorSlowly({ window, text: '`code text`', delay: 20 });

    await expect(window.locator('.ProseMirror code')).toContainText(
      'code text'
    );
  });
});

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

test.describe('undo', () => {
  test('undo removes typed text', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: 'temporary text' });
    await expect(window.locator('.ProseMirror')).toContainText(
      'temporary text'
    );

    await window.keyboard.press(`${modKey}+z`);

    await expect(window.locator('.ProseMirror')).not.toContainText(
      'temporary text'
    );
  });

  test('undo bold leaves text but removes bold', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: 'plain text' });
    await window.keyboard.press(`${modKey}+a`);
    await window.keyboard.press(`${modKey}+b`);

    await expect(window.locator('.ProseMirror strong')).toContainText(
      'plain text'
    );

    await window.keyboard.press(`${modKey}+z`);

    await expect(window.locator('.ProseMirror')).toContainText('plain text');
    await expect(window.locator('.ProseMirror strong')).toHaveCount(0);
  });

  test('undo then redo restores text', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: 'redo me' });
    await expect(window.locator('.ProseMirror')).toContainText('redo me');

    await window.keyboard.press(`${modKey}+z`);
    await expect(window.locator('.ProseMirror')).not.toContainText('redo me');

    await window.keyboard.press(`${modKey}+Shift+z`);
    await expect(window.locator('.ProseMirror')).toContainText('redo me');
  });
});

test.describe('paste markdown', () => {
  test('paste heading and paragraph', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await pasteMarkdown({ window, text: '# Heading\n\nSome paragraph' });

    await expect(window.locator('.ProseMirror h1')).toContainText('Heading');
    await expect(window.locator('.ProseMirror p')).toContainText(
      'Some paragraph'
    );
  });

  test('paste bullet list', async ({ electronApp, window, testProjectDir }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await pasteMarkdown({ window, text: '- item 1\n- item 2' });

    await expect(window.locator('.ProseMirror ul')).toBeVisible();
    await expect(window.locator('.ProseMirror li')).toHaveCount(2);
  });

  test('paste bold and italic marks', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await pasteMarkdown({ window, text: '**bold** and *italic*' });

    await expect(window.locator('.ProseMirror strong')).toContainText('bold');
    await expect(window.locator('.ProseMirror em')).toContainText('italic');
  });
});

test.describe('links', () => {
  // Helper to create a link using keyboard shortcut (avoids toolbar state issues)
  const createLinkViaKeyboard = async ({
    window,
    text,
    href,
  }: {
    window: Parameters<typeof clearEditor>[0]['window'];
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
    await clearEditor({ window });

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
    await clearEditor({ window });

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
    await clearEditor({ window });

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
    const html = await getEditorHTML({ window });
    expect(html).toContain('https://updated.com');
  });

  test('remove link from popover', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

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

test.describe('additional editing', () => {
  test('Cmd+B toggles bold', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: 'bold text' });
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
    await clearEditor({ window });

    await typeInEditor({ window, text: 'italic text' });
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

  test('select all and delete replaces content', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });

    // The editor should have initial content from hello.md
    await expect(window.locator('.ProseMirror')).toContainText('Hello');

    await clearEditor({ window });

    // After clearing, typing new text should work
    await typeInEditor({ window, text: 'New content' });
    await expect(window.locator('.ProseMirror')).toContainText('New content');
    await expect(window.locator('.ProseMirror')).not.toContainText(
      'test document'
    );
  });

  test('placeholder text shows when document is empty', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    // The placeholder "Start writing..." should be visible as a widget decoration
    const placeholder = window.locator('.ProseMirror span.pointer-events-none');
    await expect(placeholder).toBeVisible({ timeout: 1_000 });
    await expect(placeholder).toContainText('Start writing...');
  });

  test('typing in a new empty document works', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await typeInEditor({ window, text: 'Starting from scratch' });
    await expect(window.locator('.ProseMirror')).toContainText(
      'Starting from scratch'
    );
  });
});
