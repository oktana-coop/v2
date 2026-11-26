import { expect, test } from '../../shared/fixtures';
import {
  clearRichTextEditor,
  focusAndTypeInRichTextEditor,
  typeInRichTextEditorSlowly,
} from '../../shared/helpers';
import { setupEditor } from './helpers';

test.describe('typing', () => {
  test('types text character by character with delay', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await typeInRichTextEditorSlowly({
      window,
      text: 'Hello World',
      delay: 30,
    });

    const editor = window.locator('.ProseMirror');
    await expect(editor).toContainText('Hello World');
  });

  test('types multiple paragraphs', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: 'First paragraph' });
    await window.keyboard.press('Enter');
    await focusAndTypeInRichTextEditor({ window, text: 'Second paragraph' });
    await window.keyboard.press('Enter');
    await focusAndTypeInRichTextEditor({ window, text: 'Third paragraph' });

    const paragraphs = window.locator('.ProseMirror p');
    await expect(paragraphs).toHaveCount(3);
  });

  test('select all and delete replaces content', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });

    // The editor should have initial content from hello.md
    await expect(window.locator('.ProseMirror')).toContainText('Hello');

    await clearRichTextEditor({ window });

    // After clearing, typing new text should work
    await focusAndTypeInRichTextEditor({ window, text: 'New content' });
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
    await clearRichTextEditor({ window });

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
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({
      window,
      text: 'Starting from scratch',
    });
    await expect(window.locator('.ProseMirror')).toContainText(
      'Starting from scratch'
    );
  });
});

test.describe('markdown input rules', () => {
  test('# creates h1 heading', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '# Heading One' });

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
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '## Heading Two' });

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
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '### Heading Three' });

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
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '> Quoted text' });

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
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '```' });
    await window.keyboard.press('Enter');

    await expect(window.locator('.ProseMirror pre')).toBeVisible();
  });

  test('- creates bullet list', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '- List item' });

    await expect(window.locator('.ProseMirror ul')).toContainText('List item');
  });

  test('1. creates ordered list', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '1. First item' });

    await expect(window.locator('.ProseMirror ol')).toContainText('First item');
  });

  test('**text** creates bold', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await typeInRichTextEditorSlowly({
      window,
      text: '**bold text**',
      delay: 20,
    });

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
    await clearRichTextEditor({ window });

    await typeInRichTextEditorSlowly({
      window,
      text: '*italic text*',
      delay: 20,
    });

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
    await clearRichTextEditor({ window });

    await typeInRichTextEditorSlowly({
      window,
      text: '`code text`',
      delay: 20,
    });

    await expect(window.locator('.ProseMirror code')).toContainText(
      'code text'
    );
  });
});
