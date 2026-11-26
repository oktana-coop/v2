import { expect, test } from '../../shared/fixtures';
import {
  clearRichTextEditor,
  clickToolbarButton,
  focusAndTypeInRichTextEditor,
  openEditorToolbar,
  typeInEditor,
} from '../../shared/helpers';
import { setupEditor } from './helpers';

test.describe('horizontal rule', () => {
  test('typing --- on an empty line creates an hr', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '---' });

    await expect(window.locator('.ProseMirror hr')).toHaveCount(1);
  });

  test('typing --- inside a non-empty paragraph produces an em dash, not an hr', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: 'abc---' });

    await expect(window.locator('.ProseMirror hr')).toHaveCount(0);
    await expect(window.locator('.ProseMirror p').first()).toContainText(
      'abc—'
    );
  });

  test('typing -- followed by a space produces an en dash', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: 'abc-- ' });

    await expect(window.locator('.ProseMirror hr')).toHaveCount(0);
    await expect(window.locator('.ProseMirror p').first()).toContainText(
      'abc–'
    );
  });

  test('typing --- in an empty paragraph between two paragraphs reuses the next block', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    // alpha / [empty] / beta. After typing 'alpha' + Enter+Enter the cursor is
    // already in the third (empty) paragraph, so use `typeInEditor` (no click)
    // to keep it there.
    await focusAndTypeInRichTextEditor({ window, text: 'alpha' });
    await window.keyboard.press('Enter');
    await window.keyboard.press('Enter');
    await typeInEditor({ window, text: 'beta' });

    // Move cursor to the empty middle paragraph
    await window.keyboard.press('Home');
    await window.keyboard.press('ArrowUp');

    await typeInEditor({ window, text: '---' });

    // Result: alpha / hr / beta — exactly two paragraphs, no auto-trailing
    await expect(window.locator('.ProseMirror hr')).toHaveCount(1);
    await expect(window.locator('.ProseMirror p')).toHaveCount(2);

    // Cursor was moved into the existing "beta" paragraph at offset 0
    // (PM's `Selection.near` lands at the start of the next text block);
    // typing prepends to the existing content.
    await typeInEditor({ window, text: '-extra' });
    await expect(window.locator('.ProseMirror p').last()).toContainText(
      '-extrabeta'
    );
  });

  test('hr at end of document gets an auto-trailing paragraph and the cursor lands in it', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '---' });

    await expect(window.locator('.ProseMirror hr')).toHaveCount(1);
    // ensureTrailingParagraphPlugin always leaves an editable paragraph after the hr
    await expect(window.locator('.ProseMirror p')).toHaveCount(1);

    // Cursor should be in the trailing paragraph, not on the hr
    await typeInEditor({ window, text: 'after' });
    await expect(window.locator('.ProseMirror p').last()).toContainText(
      'after'
    );
  });

  test('toolbar hr button inserts an hr in an empty paragraph', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });
    await clearRichTextEditor({ window });

    await clickToolbarButton({ window, label: 'Horizontal Rule' });

    await expect(window.locator('.ProseMirror hr')).toHaveCount(1);
  });

  test('toolbar hr button is disabled when cursor is in a non-empty paragraph', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });

    // hello.md's paragraph has content; click into it
    await window.locator('.ProseMirror p').first().click();

    await expect(
      window.getByRole('button', { name: 'Horizontal Rule' })
    ).toBeDisabled();
  });

  test('toolbar hr button enables when cursor moves to an empty paragraph', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await openEditorToolbar({ window });
    await clearRichTextEditor({ window });

    // After clearing, the cursor is in an empty paragraph
    await expect(
      window.getByRole('button', { name: 'Horizontal Rule' })
    ).toBeEnabled();
  });

  test('Backspace at start of paragraph after hr selects the hr; second Backspace removes it', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: '---' });
    await expect(window.locator('.ProseMirror hr')).toHaveCount(1);

    // First Backspace: empty trailing paragraph is removed and the hr becomes
    // a NodeSelection. The trailing-paragraph plugin then re-adds an empty
    // paragraph so the doc still has hr + p, but selection stays on the hr.
    await window.keyboard.press('Backspace');
    await expect(window.locator('.ProseMirror hr')).toHaveClass(
      /ProseMirror-selectednode/
    );

    // Second Backspace deletes the selected hr
    await window.keyboard.press('Backspace');
    await expect(window.locator('.ProseMirror hr')).toHaveCount(0);
  });
});
