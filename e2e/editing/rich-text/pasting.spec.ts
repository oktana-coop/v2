import { expect, test } from '../../shared/fixtures';
import {
  clearRichTextEditor,
  expectErrorNotification,
  pasteMarkdown,
} from '../../shared/helpers';
import { setupEditor } from './helpers';

test.describe('paste markdown', () => {
  test('paste heading and paragraph', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await pasteMarkdown({ window, text: '# Heading\n\nSome paragraph' });

    await expect(window.locator('.ProseMirror h1')).toContainText('Heading');
    await expect(window.locator('.ProseMirror p')).toContainText(
      'Some paragraph'
    );
  });

  test('paste bullet list', async ({ electronApp, window, testProjectDir }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

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
    await clearRichTextEditor({ window });

    await pasteMarkdown({ window, text: '**bold** and *italic*' });

    await expect(window.locator('.ProseMirror strong')).toContainText('bold');
    await expect(window.locator('.ProseMirror em')).toContainText('italic');
  });

  test('pasting a table shows an error saying the editor can not show tables yet', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await pasteMarkdown({
      window,
      text: '# Heading\n\n| a | b |\n|---|---|\n| 1 | 2 |\n',
    });

    await expectErrorNotification({
      window,
      message: "The editor can't show tables yet.",
    });
    await expect(window.locator('.ProseMirror h1')).toHaveCount(0);
  });
});
