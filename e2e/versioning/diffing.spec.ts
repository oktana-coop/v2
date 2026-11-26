import {
  type ElectronApplication,
  type Locator,
  type Page,
} from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import {
  clearRichTextEditor,
  clickToolbarButton,
  commitChanges,
  enableShowDiff,
  focusParagraph,
  insertImageFromToolbar,
  lineEndKey,
  metadataPanel,
  mockPickFile,
  modKey,
  moveToEndOfFirstPlainTextLine,
  navigateToProjectHistory,
  openEditorToolbar,
  openHelloMd,
  openPlainTextDocument,
  openProjectFolder,
  pasteMarkdown,
  PNG_1x1,
  seedExternalImage,
  selectChangedDocument,
  selectFirstCommit,
  selectUncommittedChanges,
  showMetadata,
  toggleProjectCommit,
  typeAtEndOfPlainTextDocument,
  typeInEditorAndWaitForDebounce,
  typeInParagraphAndWaitForDebounce,
} from '../shared/helpers';

test.describe('diff controls', () => {
  test('diffing can be turned on for uncommitted changes', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await typeInEditorAndWaitForDebounce({ window, text: ' v1' });
    await commitChanges({ window, message: 'base commit' });

    await typeInEditorAndWaitForDebounce({ window, text: ' v2' });
    await selectUncommittedChanges({ window });

    await enableShowDiff({ window });

    // The document-history panel should still be visible
    await expect(window.getByTestId('document-history')).toBeVisible();
  });

  test('diffing can be turned on for every commit but the first', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await typeInEditorAndWaitForDebounce({ window, text: ' first' });
    await commitChanges({ window, message: 'first commit' });

    // Any commit with a predecessor should show the diff controls
    await selectFirstCommit({ window, commitMessage: 'first commit' });
    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });
    await expect(window.getByLabel(/show diff with/i)).toBeVisible();

    // The initial snapshot has nothing to diff against, so it hides them
    await selectFirstCommit({ window, commitMessage: 'Set up versioning' });
    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });
    await expect(window.getByLabel(/show diff with/i)).toBeHidden();
  });
});

test.describe('diff annotations in a rich-text document', () => {
  test('highlight text inserted by a commit', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await typeInParagraphAndWaitForDebounce({ window, text: ' first' });
    await commitChanges({ window, message: 'first commit' });

    await typeInParagraphAndWaitForDebounce({ window, text: ' second' });
    await commitChanges({ window, message: 'second commit' });

    await selectFirstCommit({ window, commitMessage: 'second commit' });

    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });

    await enableShowDiff({ window });

    // The inserted text "second" should be highlighted with the insert diff class
    const insertAnnotation = window.locator('.ProseMirror .diff-insert');
    await expect(insertAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(insertAnnotation).toContainText('second');
  });

  test('highlight text inserted since the last commit', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await typeInParagraphAndWaitForDebounce({ window, text: ' baseline' });
    await commitChanges({ window, message: 'baseline' });

    await typeInParagraphAndWaitForDebounce({ window, text: ' new addition' });
    await selectUncommittedChanges({ window });

    await enableShowDiff({ window });

    // The inserted text "new addition" should be highlighted as an insert
    const insertAnnotation = window.locator('.ProseMirror .diff-insert');
    await expect(insertAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(insertAnnotation).toContainText('new addition');
  });

  test('highlight bolded text as modified', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await typeInParagraphAndWaitForDebounce({ window, text: ' one two three' });
    await commitChanges({ window, message: 'before bold' });

    // Select the paragraph text and bold it (Home → Shift+End is cross-platform)
    await focusParagraph({ window });
    await window.keyboard.press('Home');
    await window.keyboard.press('Shift+End');
    await clickToolbarButton({ window, label: 'Bold' });
    await commitChanges({ window, message: 'after bold' });

    await selectFirstCommit({ window, commitMessage: 'after bold' });
    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });

    await enableShowDiff({ window });

    // The bolded word should be highlighted with the modify class
    const modifyAnnotation = window.locator('.ProseMirror .diff-modify');
    await expect(modifyAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(modifyAnnotation).toContainText('three');
  });

  test('highlight a changed heading level as modified', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    await openEditorToolbar({ window });

    await typeInEditorAndWaitForDebounce({ window, text: ' original' });
    await commitChanges({ window, message: 'before heading change' });

    // Change heading from H1 to H2 via block select dropdown
    await window.locator('.ProseMirror h1').click();
    await window.locator('[data-slot="control"]').click();
    await window.getByRole('option', { name: 'Heading 2' }).click();
    await commitChanges({ window, message: 'after heading change' });

    await selectFirstCommit({ window, commitMessage: 'after heading change' });
    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });

    await enableShowDiff({ window });

    // The heading text should be highlighted with the modify class
    const modifyAnnotation = window.locator('.ProseMirror .diff-modify');
    await expect(modifyAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(modifyAnnotation).toContainText('Hello');
  });

  test('highlight text inserted by a commit in the project history', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await typeInEditorAndWaitForDebounce({ window, text: ' version one' });
    await commitChanges({ window, message: 'first commit' });

    await typeInEditorAndWaitForDebounce({ window, text: ' version two' });
    await commitChanges({ window, message: 'second commit' });

    await navigateToProjectHistory({ window });
    await toggleProjectCommit({ window, commitMessage: 'second commit' });
    await selectChangedDocument({ window, fileName: 'hello' });

    await expect(window.locator('.ProseMirror')).toBeVisible({
      timeout: 1_000,
    });

    await enableShowDiff({ window });

    // The inserted text "version two" should be highlighted as an insert
    const insertAnnotation = window.locator('.ProseMirror .diff-insert');
    await expect(insertAnnotation).toBeVisible({ timeout: 1_000 });
    await expect(insertAnnotation).toContainText('version two');
  });

  const openCommitDiffForHello = async (
    window: Page,
    commitMessage: string
  ): Promise<void> => {
    await navigateToProjectHistory({ window });
    await toggleProjectCommit({ window, commitMessage });
    await selectChangedDocument({ window, fileName: 'hello' });
    await enableShowDiff({ window });
  };

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
    await clearRichTextEditor({ window });
    await pasteMarkdown({ window, text: 'baseline' });
    await window.waitForTimeout(600);
    await commitChanges({ window, message: 'baseline' });

    // Add a figure and commit it.
    await clearRichTextEditor({ window });
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
    await clearRichTextEditor({ window });

    // Commit a document that contains the figure.
    await mockPickFile({ electronApp, filePath: externalImage });
    await insertImageFromToolbar(window);
    await window.waitForTimeout(600);
    await commitChanges({ window, message: 'with image' });

    // Remove the figure and commit.
    await clearRichTextEditor({ window });
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

test.describe("diff annotations in a rich-text document's metadata", () => {
  // hello.md with the given front matter, open in the editor.
  const openHelloMdWithFrontMatter = async ({
    electronApp,
    window,
    testProjectDir,
    frontMatter,
  }: {
    electronApp: ElectronApplication;
    window: Page;
    testProjectDir: string;
    frontMatter: string;
  }) => {
    fs.writeFileSync(
      path.join(testProjectDir, 'hello.md'),
      `---\n${frontMatter}\n---\n\n# Hello\n`,
      'utf8'
    );
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
  };

  // Rewrites hello.md outside the app, with a longer heading, and waits for the editor to show it.
  const editHelloMdOutside = async ({
    window,
    testProjectDir,
    frontMatter,
  }: {
    window: Page;
    testProjectDir: string;
    frontMatter: string | null;
  }) => {
    const body = '# Hello again\n';
    fs.writeFileSync(
      path.join(testProjectDir, 'hello.md'),
      frontMatter === null ? body : `---\n${frontMatter}\n---\n\n${body}`,
      'utf8'
    );
    await expect(window.locator('.ProseMirror').locator('h1')).toHaveText(
      'Hello again',
      { timeout: 5_000 }
    );
  };

  test('highlight the metadata keys a commit added, removed and changed', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: First\nstatus: draft\ndraft: true',
    });
    await editHelloMdOutside({
      window,
      testProjectDir,
      frontMatter: 'title: Second\ndraft: false\ntags:\n- essay',
    });
    await commitChanges({ window, message: 'second version' });
    await selectFirstCommit({ window, commitMessage: 'second version' });
    await showMetadata({ window });
    const panel = metadataPanel({ window });

    await enableShowDiff({ window });

    const keys = panel.getByRole('term');
    const values = panel.getByRole('definition');

    await expect(keys).toHaveText(['title', 'status', 'draft', 'tags']);
    await expect(keys.getByRole('deletion')).toHaveText(['status']);
    await expect(keys.getByRole('insertion')).toHaveText(['tags']);
    // The empty texts are the draft checkboxes, checked below.
    await expect(values.getByRole('deletion')).toHaveText([
      'First',
      'draft',
      '',
    ]);
    await expect(values.getByRole('insertion')).toHaveText([
      'Second',
      '',
      'essay',
    ]);
    await expect(
      values.getByRole('deletion').getByRole('checkbox', { name: 'draft' })
    ).toBeChecked();
    await expect(
      values.getByRole('insertion').getByRole('checkbox', { name: 'draft' })
    ).not.toBeChecked();
  });

  test('highlight no metadata for a commit that changed only the body', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: First',
    });
    await editHelloMdOutside({
      window,
      testProjectDir,
      frontMatter: 'title: First',
    });
    await commitChanges({ window, message: 'new heading' });
    await selectFirstCommit({ window, commitMessage: 'new heading' });
    await showMetadata({ window });
    const panel = metadataPanel({ window });

    await enableShowDiff({ window });

    // The body's marks come from the same diff as the metadata's marks.
    await expect(window.locator('.ProseMirror .diff-insert')).toContainText(
      'again'
    );
    await expect(panel.getByRole('definition')).toHaveText(['First']);
    await expect(panel.getByRole('insertion')).toHaveCount(0);
    await expect(panel.getByRole('deletion')).toHaveCount(0);
  });

  test('highlight every metadata key as removed for a commit that removed the front matter', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: First\ndraft: true',
    });
    await editHelloMdOutside({ window, testProjectDir, frontMatter: null });
    await commitChanges({ window, message: 'no front matter' });
    await selectFirstCommit({ window, commitMessage: 'no front matter' });
    await showMetadata({ window });
    const panel = metadataPanel({ window });

    await enableShowDiff({ window });

    const keys = panel.getByRole('term');
    await expect(keys).toHaveText(['title', 'draft']);
    await expect(keys.getByRole('deletion')).toHaveText(['title', 'draft']);
    // The empty text is the draft checkbox.
    await expect(
      panel.getByRole('definition').getByRole('deletion')
    ).toHaveText(['First', '']);
    await expect(panel.getByRole('insertion')).toHaveCount(0);
  });

  test('highlight the metadata changed since the last commit', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: First',
    });
    await editHelloMdOutside({
      window,
      testProjectDir,
      frontMatter: 'title: Second',
    });
    await selectUncommittedChanges({ window });
    await showMetadata({ window });
    const panel = metadataPanel({ window });

    await enableShowDiff({ window });

    await expect(panel.getByRole('deletion')).toHaveText(['First']);
    await expect(panel.getByRole('insertion')).toHaveText(['Second']);
  });

  test.describe('as YAML', () => {
    const insertedLines = (panel: Locator) => panel.locator('.cm-changedLine');
    const deletedLines = (panel: Locator) =>
      panel.locator('.cm-deletedChunk .cm-deletedLine');

    test('highlight the lines of the front matter a commit changed', async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      await openHelloMdWithFrontMatter({
        electronApp,
        window,
        testProjectDir,
        frontMatter: 'title: First\nstatus: draft',
      });
      await editHelloMdOutside({
        window,
        testProjectDir,
        frontMatter: 'title: Second\nstatus: draft',
      });
      await commitChanges({ window, message: 'second title' });
      await selectFirstCommit({ window, commitMessage: 'second title' });
      await showMetadata({ window });
      const panel = metadataPanel({ window });
      await enableShowDiff({ window });

      await panel.getByRole('button', { name: 'Show as YAML' }).click();

      await expect(insertedLines(panel)).toHaveText(['title: Second']);
      await expect(deletedLines(panel)).toHaveText(['title: First']);
    });

    test("highlight the lines of front matter a commit fixed, which couldn't be read before", async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      await openHelloMdWithFrontMatter({
        electronApp,
        window,
        testProjectDir,
        frontMatter: 'title: [unclosed',
      });
      await editHelloMdOutside({
        window,
        testProjectDir,
        frontMatter: 'title: Fixed',
      });
      await commitChanges({ window, message: 'fixed front matter' });
      await selectFirstCommit({ window, commitMessage: 'fixed front matter' });
      await showMetadata({ window });
      const panel = metadataPanel({ window });
      await enableShowDiff({ window });

      await panel.getByRole('button', { name: 'Show as YAML' }).click();

      await expect(insertedLines(panel)).toHaveText(['title: Fixed']);
      await expect(deletedLines(panel)).toHaveText(['title: [unclosed']);
    });
  });
});

test.describe('diff annotations in a plain-text document', () => {
  // A YAML file of two lines, open in the editor.
  const openConfigYaml = async ({
    electronApp,
    window,
    testProjectDir,
  }: {
    electronApp: ElectronApplication;
    window: Page;
    testProjectDir: string;
  }) => {
    fs.writeFileSync(
      path.join(testProjectDir, 'config.yaml'),
      'name: v2\nversion: 1.2\n'
    );
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'config.yaml' });
  };

  const insertedLines = (window: Page) => window.locator('.cm-changedLine');
  const deletedLines = (window: Page) =>
    window.locator('.cm-deletedChunk .cm-deletedLine');

  test('highlight a line added by a commit', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openConfigYaml({ electronApp, window, testProjectDir });
    await typeAtEndOfPlainTextDocument({ window, text: 'owner: oktana' });
    await commitChanges({ window, message: 'add the owner' });

    await selectFirstCommit({ window, commitMessage: 'add the owner' });
    await enableShowDiff({ window });

    await expect(insertedLines(window)).toHaveText(['owner: oktana'], {
      timeout: 5_000,
    });
  });

  test('highlight a line deleted by a commit', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openConfigYaml({ electronApp, window, testProjectDir });
    await moveToEndOfFirstPlainTextLine({ window });
    await window.keyboard.press('ArrowDown');
    await window.keyboard.press(`${modKey}+Shift+k`);
    await commitChanges({ window, message: 'drop the version' });

    await selectFirstCommit({ window, commitMessage: 'drop the version' });
    await enableShowDiff({ window });

    await expect(deletedLines(window)).toHaveText(['version: 1.2'], {
      timeout: 5_000,
    });
    await expect(insertedLines(window)).toHaveCount(0);
  });

  test('highlight a line edited by a commit, as it was and as it is', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openConfigYaml({ electronApp, window, testProjectDir });
    await moveToEndOfFirstPlainTextLine({ window });
    await window.keyboard.press('ArrowDown');
    await window.keyboard.press(lineEndKey);
    await window.keyboard.type('5');
    await commitChanges({ window, message: 'bump the version' });

    await selectFirstCommit({ window, commitMessage: 'bump the version' });
    await enableShowDiff({ window });

    await expect(deletedLines(window)).toHaveText(['version: 1.2'], {
      timeout: 5_000,
    });
    await expect(insertedLines(window)).toHaveText(['version: 1.25']);
  });

  test('highlight a line added since the last commit', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    await openConfigYaml({ electronApp, window, testProjectDir });
    await typeAtEndOfPlainTextDocument({ window, text: 'owner: oktana' });

    await selectUncommittedChanges({ window });
    await enableShowDiff({ window });

    await expect(insertedLines(window)).toHaveText(['owner: oktana'], {
      timeout: 5_000,
    });
  });
});
