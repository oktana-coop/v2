import { type Locator, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  openPlainTextDocument,
  openProjectFolder,
  openRichTextDocument,
  selectFirstCommit,
} from '../shared/helpers';

test.describe('a document wider than the window', () => {
  test('keeps a plain-text file with a very long line within the window', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    // A minified stylesheet: one line of about 50,000 characters.
    fs.writeFileSync(
      path.join(testProjectDir, 'wide.css'),
      '.note{color:red}'.repeat(3_000)
    );
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'wide.css' });

    const windowWidth = await window.evaluate(() => globalThis.innerWidth);
    const sidebarBox = await window.getByTestId('file-explorer').boundingBox();
    const editorBox = await window.locator('.cm-scroller').boundingBox();

    expect(sidebarBox?.width).toBeLessThan(windowWidth);
    expect(editorBox?.width).toBeLessThan(windowWidth);
  });

  // The editor, and its code block, fit the window, and nothing overflows the
  // editor: long words wrap and long code lines scroll in their block.
  const expectRichTextEditorWithinWindow = async ({
    window,
    editor,
  }: {
    window: Page;
    editor: Locator;
  }) => {
    const windowWidth = await window.evaluate(() => globalThis.innerWidth);
    const editorBox = await editor.boundingBox();
    const codeBlockBox = await editor.locator('pre').boundingBox();
    const overflow = await editor.evaluate(
      (element) => element.scrollWidth - element.clientWidth
    );

    expect(editorBox?.width).toBeLessThan(windowWidth);
    expect(codeBlockBox?.width).toBeLessThan(windowWidth);
    expect(overflow).toBe(0);
  };

  test('keeps a rich-text document with a long word and a long code line within the window, while editing and in its history', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const longWord = 'dafslkjdasfljadsflkjhadskjlfdaslfhkjdlahsf'.repeat(16);
    fs.writeFileSync(
      path.join(testProjectDir, 'Wide.md'),
      `# Wide\n\n${longWord}\n\n\`\`\`js\nconst value = "${longWord}";\n\`\`\`\n`
    );
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openRichTextDocument({ window, relativePath: 'Wide.md' });

    await expectRichTextEditorWithinWindow({
      window,
      editor: window.locator('.ProseMirror[contenteditable="true"]'),
    });

    // Read-only views don't get the browser's wrapping for editable text.
    await selectFirstCommit({ window, commitMessage: 'Set up versioning' });
    const historicalEditor = window.locator(
      '.ProseMirror[contenteditable="false"]'
    );
    await expect(historicalEditor).toBeVisible({ timeout: 5_000 });
    await expectRichTextEditorWithinWindow({
      window,
      editor: historicalEditor,
    });
  });
});
