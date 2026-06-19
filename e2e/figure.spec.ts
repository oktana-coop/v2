import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Page } from '@playwright/test';
import git from 'isomorphic-git';

import { expect, test } from './shared/fixtures';
import {
  clearEditor,
  clickToolbarButton,
  commitChanges,
  enableShowDiff,
  mockPickFile,
  navigateToProjectHistory,
  openEditorToolbar,
  openHelloMd,
  openProjectFolder,
  pasteMarkdown,
  selectChangedDocument,
  toggleProjectCommit,
} from './shared/helpers';

// A real, minimal 1x1 PNG.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Creates a throwaway directory outside the project to hold a source image,
// exercising the "pick a file from elsewhere → copy it into the project" flow.
const seedExternalImage = (name: string, bytes: Buffer): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-ext-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, bytes);
  return filePath;
};

const insertImageFromToolbar = async (window: Page): Promise<void> => {
  await openEditorToolbar({ window });
  await clickToolbarButton({ window, label: 'Image' });
  await window.waitForSelector('.ProseMirror figure img', { timeout: 2_000 });
  await window.waitForTimeout(300);
};

// Asserts the figure's <img> actually loaded its bytes through the
// project-asset:// protocol (naturalWidth stays 0 for a broken/unresolved src).
const expectFigureImageRendered = async (window: Page): Promise<void> => {
  const img = window.locator('.ProseMirror figure img').first();
  const src = await img.getAttribute('src');
  expect(src?.startsWith('project-asset://')).toBe(true);
  await expect
    .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
      timeout: 3_000,
    })
    .toBeGreaterThan(0);
};

const openCommitDiffForHello = async (
  window: Page,
  commitMessage: string
): Promise<void> => {
  await navigateToProjectHistory({ window });
  await toggleProjectCommit({ window, commitMessage });
  await selectChangedDocument({ window, fileName: 'hello' });
  await enableShowDiff({ window });
};

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

test.describe('figure', () => {
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
    await clearEditor({ window });

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
    await clearEditor({ window });

    await mockPickFile({ electronApp, filePath: externalImage });
    await insertImageFromToolbar(window);

    // The asset was copied into the project's assets folder, byte-for-byte.
    const copiedPath = path.join(testProjectDir, 'assets', 'photo.png');
    expect(fs.existsSync(copiedPath)).toBe(true);
    expect(fs.readFileSync(copiedPath)).toEqual(PNG_1x1);

    await expectFigureImageRendered(window);

    fs.rmSync(path.dirname(externalImage), { recursive: true, force: true });
  });

  test('an inserted image is written to markdown and survives a reload', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const externalImage = seedExternalImage('photo.png', PNG_1x1);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    await clearEditor({ window });

    await mockPickFile({ electronApp, filePath: externalImage });
    await insertImageFromToolbar(window);
    // Let the debounced save flush the figure to hello.md.
    await window.waitForTimeout(600);

    // The figure serializes back to a Markdown image reference on disk.
    const md = fs.readFileSync(path.join(testProjectDir, 'hello.md'), 'utf8');
    expect(md).toContain('](assets/photo.png)');

    await window.reload();
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    await window.waitForSelector('.ProseMirror figure img', { timeout: 2_000 });

    await expectFigureImageRendered(window);

    fs.rmSync(path.dirname(externalImage), { recursive: true, force: true });
  });

  test('committing a doc with a new image stages the asset in the same commit', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const externalImage = seedExternalImage('photo.png', PNG_1x1);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    await clearEditor({ window });

    await mockPickFile({ electronApp, filePath: externalImage });
    await insertImageFromToolbar(window);
    await window.waitForTimeout(600);

    await commitChanges({ window, message: 'add image' });

    const committed = await git.listFiles({
      fs,
      dir: testProjectDir,
      ref: 'HEAD',
    });
    expect(committed).toContain('hello.md');
    expect(committed).toContain('assets/photo.png');

    // The committed document is viewable in project history with its image.
    await navigateToProjectHistory({ window });
    await toggleProjectCommit({ window, commitMessage: 'add image' });
    await selectChangedDocument({ window, fileName: 'hello' });
    await window.waitForSelector('.ProseMirror figure img', { timeout: 2_000 });
    await expectFigureImageRendered(window);

    fs.rmSync(path.dirname(externalImage), { recursive: true, force: true });
  });

  test('an added figure is highlighted as an insertion in the diff', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const externalImage = seedExternalImage('photo.png', PNG_1x1);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    // Baseline commit: a non-empty doc with no figure, so the figure commit has
    // a parent to diff against.
    await clearEditor({ window });
    await pasteMarkdown({ window, text: 'baseline' });
    await window.waitForTimeout(600);
    await commitChanges({ window, message: 'baseline' });

    // Add a figure and commit it.
    await clearEditor({ window });
    await mockPickFile({ electronApp, filePath: externalImage });
    await insertImageFromToolbar(window);
    await window.waitForTimeout(600);
    await commitChanges({ window, message: 'add image' });

    await openCommitDiffForHello(window, 'add image');

    await expect(
      window.locator(
        '.ProseMirror figure.diff-insert, .ProseMirror figure:has(.diff-insert)'
      )
    ).toBeVisible({ timeout: 2_000 });

    fs.rmSync(path.dirname(externalImage), { recursive: true, force: true });
  });

  test('a removed figure is highlighted as a deletion in the diff', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const externalImage = seedExternalImage('photo.png', PNG_1x1);

    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    await clearEditor({ window });

    // Commit a document that contains the figure.
    await mockPickFile({ electronApp, filePath: externalImage });
    await insertImageFromToolbar(window);
    await window.waitForTimeout(600);
    await commitChanges({ window, message: 'with image' });

    // Remove the figure and commit.
    await clearEditor({ window });
    await window.waitForTimeout(600);
    await commitChanges({ window, message: 'remove image' });

    await openCommitDiffForHello(window, 'remove image');

    // The removed figure is rendered with the parent wrapped in a delete decoration
    await expect(
      window.locator('.ProseMirror .diff-delete figure')
    ).toBeVisible({ timeout: 2_000 });

    fs.rmSync(path.dirname(externalImage), { recursive: true, force: true });
  });
});
