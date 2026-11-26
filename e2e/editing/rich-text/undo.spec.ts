import { expect, test } from '../../shared/fixtures';
import {
  clearRichTextEditor,
  focusAndTypeInRichTextEditor,
  modKey,
  pressRedo,
  pressUndo,
} from '../../shared/helpers';
import { setupEditor } from './helpers';

test.describe('undo', () => {
  test('undo removes typed text', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: 'temporary text' });
    await expect(window.locator('.ProseMirror')).toContainText(
      'temporary text'
    );

    await pressUndo({ window });

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
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: 'plain text' });
    await window.keyboard.press(`${modKey}+a`);
    await window.keyboard.press(`${modKey}+b`);

    await expect(window.locator('.ProseMirror strong')).toContainText(
      'plain text'
    );

    await pressUndo({ window });

    await expect(window.locator('.ProseMirror')).toContainText('plain text');
    await expect(window.locator('.ProseMirror strong')).toHaveCount(0);
  });

  test('undo then redo restores text', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await focusAndTypeInRichTextEditor({ window, text: 'redo me' });
    await expect(window.locator('.ProseMirror')).toContainText('redo me');

    await pressUndo({ window });
    await expect(window.locator('.ProseMirror')).not.toContainText('redo me');

    await pressRedo({ window });
    await expect(window.locator('.ProseMirror')).toContainText('redo me');
  });
});
