import * as fs from 'node:fs';
import * as path from 'node:path';

import { expect, test } from '../../shared/fixtures';
import {
  clearRichTextEditor,
  expectFigureImageRendered,
  insertImageFromToolbar,
  mockPickFile,
  openHelloMd,
  openProjectFolder,
  pasteMarkdown,
  PNG_1x1,
  seedExternalImage,
} from '../../shared/helpers';
import { setupEditor } from './helpers';

test.describe('figure', () => {
  test('single Backspace from below removes the figure', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await pasteMarkdown({
      window,
      text: `# Foo\n\n![one](assets/one.jpg)\n`,
    });

    const figure = window.locator('.ProseMirror figure');
    await expect(figure).toHaveCount(1);

    // Land cursor in the trailing paragraph below the figure.
    const figureBox = await figure.first().boundingBox();
    expect(figureBox).toBeTruthy();
    if (!figureBox) return;

    await window.mouse.click(
      figureBox.x + 20,
      figureBox.y + figureBox.height + 20
    );

    await window.keyboard.press('Backspace');
    await expect(figure).toHaveCount(0);
  });

  test('clicking below the figure lands the cursor in the trailing paragraph', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearRichTextEditor({ window });

    await pasteMarkdown({
      window,
      text: `# Foo\n\n![hide-the-pain-harold](assets/hide-the-pain-harold.jpg)\n`,
    });

    const figure = window.locator('.ProseMirror figure');
    await expect(figure).toHaveCount(1);

    // Click below the figure (where the trailing paragraph lives) and type.
    const figureBox = await figure.first().boundingBox();
    expect(figureBox).toBeTruthy();
    if (!figureBox) return;
    await window.mouse.click(
      figureBox.x + 20,
      figureBox.y + figureBox.height + 20
    );
    await window.keyboard.type('typed below figure');

    // The text must land in the trailing paragraph (the <p> right after the
    // <figure>) — not inside the figure, where PM's textblock-rendering
    // artifacts used to capture clicks.
    await expect(window.locator('.ProseMirror figure + p').first()).toHaveText(
      'typed below figure'
    );
    // The cursor didn't land inside the figure, so no text leaked into it.
    await expect(figure.first()).not.toContainText('typed below figure');
  });

  test('copies an image picked from outside the project and renders it', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    // The picked file lives outside the project, so it must be copied
    // into the assets folder (not referenced in place).
    const externalImage = seedExternalImage('photo.png', PNG_1x1);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    await clearRichTextEditor({ window });

    await mockPickFile({ electronApp, filePath: externalImage });
    await insertImageFromToolbar(window);

    // The asset was copied into the project's assets folder, byte-for-byte.
    const copiedPath = path.join(testProjectDir, 'assets', 'photo.png');
    expect(fs.existsSync(copiedPath)).toBe(true);
    expect(fs.readFileSync(copiedPath)).toEqual(PNG_1x1);

    await expectFigureImageRendered({ window });

    fs.rmSync(path.dirname(externalImage), { recursive: true, force: true });
  });
});
