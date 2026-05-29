import * as fs from 'node:fs';
import * as path from 'node:path';

import { Page } from '@playwright/test';

import { expect, test } from './shared/fixtures';
import {
  clearEditor,
  clickToolbarButton,
  openEditorToolbar,
  openHelloMd,
  openProjectFolder,
  pasteMarkdown,
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

type PMNode = {
  type: string;
  content?: PMNode[];
  text?: string;
};

const dumpEditorDoc = async (window: Page): Promise<PMNode | null> =>
  window.evaluate(() => {
    const editorEl = document.querySelector('.ProseMirror') as
      | (HTMLElement & { pmViewDesc?: { node: { toJSON: () => unknown } } })
      | null;
    return editorEl?.pmViewDesc?.node.toJSON() as PMNode | null;
  });

test.describe('figure', () => {
  test('image inserted into a nested doc gets a document-relative src', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    // Seed assets/photo.jpg at the project root and a doc at docs/notes.md.
    // The doc lives one folder deep so the doc-relative path to the asset
    // is `../assets/photo.jpg` rather than `assets/photo.jpg`.
    const assetsDir = path.join(testProjectDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const assetPath = path.join(assetsDir, 'photo.jpg');
    fs.writeFileSync(assetPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    const docsDir = path.join(testProjectDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(
      path.join(docsDir, 'notes.md'),
      '# Notes\n\nNested doc.\n'
    );

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });

    // Open the nested doc. react-arborist expands all folders by default,
    // so the file is directly clickable.
    await window.getByText('notes.md').click();
    await window.waitForSelector('.ProseMirror', { timeout: 2_000 });
    await window.waitForTimeout(200);
    // Image insertion requires the cursor to be in an empty paragraph
    // (`canInsertFigure`), so wipe the doc's content first.
    await clearEditor({ window });

    // Mock the file-picker to return the existing asset at the project root.
    await electronApp.evaluate(async ({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [p],
      });
    }, assetPath);

    await openEditorToolbar({ window });
    await clickToolbarButton({ window, label: 'Image' });

    await window.waitForSelector('.ProseMirror figure', { timeout: 2_000 });
    await window.waitForTimeout(300);

    const doc = await dumpEditorDoc(window);
    const figure = doc?.content?.find((c) => c.type === 'figure');
    const image = figure?.content?.[0]?.content?.[0];
    expect(image?.type).toBe('image');

    const imgAttrs = (
      image as unknown as { attrs?: { src?: string } } | undefined
    )?.attrs;
    // The figure's src is relative to the doc's location, not the project
    // root — the doc is one folder deep, so it should walk up one level.
    expect(imgAttrs?.src).toBe('../assets/photo.jpg');

    // No duplicate copy was created at the project root.
    const entries = fs.readdirSync(assetsDir).sort();
    expect(entries).toEqual(['photo.jpg']);
  });

  test('reuses an asset that already lives in the project assets folder', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    // Seed the assets folder with a real file before opening the project.
    const assetsDir = path.join(testProjectDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const assetPath = path.join(assetsDir, 'photo.jpg');
    fs.writeFileSync(assetPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9])); // tiny "jpeg"

    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    // Mock the file-picker dialog to return the asset that's already in the
    // project (this is what `filesystem.openFile` resolves to under the hood).
    await electronApp.evaluate(async ({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [p],
      });
    }, assetPath);

    await openEditorToolbar({ window });
    await clickToolbarButton({ window, label: 'Image' });

    // Wait for the figure to appear in the editor.
    await window.waitForSelector('.ProseMirror figure', { timeout: 2_000 });
    await window.waitForTimeout(300);

    // The figure's image src should match the existing file's relative path.
    const doc = await dumpEditorDoc(window);
    const figure = doc?.content?.find((c) => c.type === 'figure');
    const image = figure?.content?.[0]?.content?.[0];
    expect(image?.type).toBe('image');
    expect(
      (image?.content as unknown) ??
        (image as unknown as { attrs?: { src?: string } } | undefined)?.attrs
          ?.src
    ).toBeDefined();
    // PMNode dump exposes attrs on the node directly.
    const imgAttrs = (
      image as unknown as { attrs?: { src?: string } } | undefined
    )?.attrs;
    expect(imgAttrs?.src).toBe('assets/photo.jpg');

    // No duplicate copy was created — directory still has only the original.
    const entries = fs.readdirSync(assetsDir).sort();
    expect(entries).toEqual(['photo.jpg']);
  });

  test('deleting an image leaves no empty figure behind', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    // Two figures back-to-back exercise the multi-figure delete path the
    // user reported (deleting the lower one used to leave an empty <figure>
    // shell that Pandoc serialized as raw HTML).
    await pasteMarkdown({
      window,
      text:
        `# Foo\n\n` + `![one](assets/one.jpg)\n\n` + `![two](assets/two.jpg)\n`,
    });
    await window.waitForTimeout(500);

    const docBefore = await dumpEditorDoc(window);
    expect(docBefore?.content?.map((c) => c.type)).toEqual([
      'heading',
      'figure',
      'figure',
      'paragraph',
    ]);

    // Click the second figure (selects the inline image inside it) and
    // delete. The plugin should drop the now-empty figure, not leave it
    // behind as an empty shell.
    const secondFigure = window.locator('.ProseMirror figure').nth(1);
    await secondFigure.click();
    await window.keyboard.press('Delete');
    await window.waitForTimeout(200);

    const docAfter = await dumpEditorDoc(window);
    const topLevel = docAfter?.content?.map((c) => c.type) ?? [];
    expect(topLevel).toEqual(['heading', 'figure', 'paragraph']);

    // The remaining figure must still hold its image (we deleted the right one).
    const remainingFigure = docAfter?.content?.[1];
    const remainingImage = remainingFigure?.content?.[0]?.content?.[0];
    expect(remainingImage?.type).toBe('image');
  });

  test('single Backspace from below removes the figure', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await pasteMarkdown({
      window,
      text: `# Foo\n\n![one](assets/one.jpg)\n`,
    });
    await window.waitForTimeout(500);

    const docBefore = await dumpEditorDoc(window);
    expect(docBefore?.content?.map((c) => c.type)).toEqual([
      'heading',
      'figure',
      'paragraph',
    ]);

    // Land cursor in the trailing paragraph below the figure.
    const figureBox = await window
      .locator('.ProseMirror figure')
      .first()
      .boundingBox();
    expect(figureBox).toBeTruthy();
    if (!figureBox) return;
    await window.mouse.click(
      figureBox.x + 20,
      figureBox.y + figureBox.height + 20
    );
    await window.waitForTimeout(100);

    // One Backspace must delete the figure (regression: previously took three
    // because PM's default join-backward kept trying to put the cursor inside
    // the atomic figure_content while the trailing-paragraph plugin reverted
    // each pass).
    await window.keyboard.press('Backspace');
    await window.waitForTimeout(200);

    const docAfter = await dumpEditorDoc(window);
    expect(docAfter?.content?.map((c) => c.type)).toEqual([
      'heading',
      'paragraph',
    ]);
  });

  test('Enter on a selected image drops the cursor into a paragraph below', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    await pasteMarkdown({
      window,
      text: `# Foo\n\n![hide](assets/hide.jpg)\n`,
    });
    await window.waitForTimeout(500);

    // Click the figure (which sets a NodeSelection on the inline image).
    await window.locator('.ProseMirror figure').first().click();
    await window.waitForTimeout(100);

    await window.keyboard.press('Enter');
    await window.waitForTimeout(100);

    await window.keyboard.type('after image');
    await window.waitForTimeout(200);

    const docAfter = await dumpEditorDoc(window);
    expect(docAfter?.content?.map((c) => c.type)).toEqual([
      'heading',
      'figure',
      'paragraph',
    ]);
    const para = docAfter?.content?.[2];
    expect(para?.content?.[0]?.text).toBe('after image');
  });

  test('clicking below the figure lands the cursor in the trailing paragraph', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await setupEditor({ electronApp, window, testProjectDir });
    await clearEditor({ window });

    // Pasting `![alt](src)` exercises the same Pandoc → PM path the user hits
    // on reload, producing a `figure { figure_content { image } }` node.
    await pasteMarkdown({
      window,
      text: `# Foo\n\n![hide-the-pain-harold](assets/hide-the-pain-harold.jpg)\n`,
    });
    await window.waitForTimeout(500);

    // Sanity: the figure has the expected nested shape.
    const docBefore = await dumpEditorDoc(window);
    expect(docBefore?.content?.map((c) => c.type)).toEqual([
      'heading',
      'figure',
      'paragraph',
    ]);
    const figure = docBefore?.content?.[1];
    expect(figure?.content?.map((c) => c.type)).toEqual(['figure_content']);
    expect(figure?.content?.[0].content?.map((c) => c.type)).toEqual(['image']);

    // Click below the figure (where the trailing paragraph lives) and type.
    const figureBox = await window
      .locator('.ProseMirror figure')
      .first()
      .boundingBox();
    expect(figureBox).toBeTruthy();
    if (!figureBox) return;
    await window.mouse.click(
      figureBox.x + 20,
      figureBox.y + figureBox.height + 20
    );
    await window.keyboard.type('typed below figure');
    await window.waitForTimeout(200);

    // The typed text must land in the trailing paragraph at doc level — not
    // inside `figure_content` (where PM's textblock-rendering artifacts used
    // to capture clicks).
    const docAfter = await dumpEditorDoc(window);
    const trailing = docAfter?.content?.[2];
    expect(trailing?.type).toBe('paragraph');
    expect(trailing?.content?.[0]?.text).toBe('typed below figure');

    // And the figure body stays untouched.
    const figureAfter = docAfter?.content?.[1];
    expect(figureAfter?.content?.[0].content?.map((c) => c.type)).toEqual([
      'image',
    ]);
  });
});
