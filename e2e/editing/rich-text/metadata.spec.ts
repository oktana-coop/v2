import { type ElectronApplication, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../../shared/fixtures';
import {
  focusAndTypeInRichTextEditor,
  metadataPanel,
  modKey,
  openHelloMd,
  openProjectFolder,
  showMetadata,
} from '../../shared/helpers';

const frontMatter = [
  'title: Hello *world*',
  'abstract: |',
  '  First paragraph.',
  '',
  '  Second paragraph.',
  'draft: true',
  'tags:',
  '- history',
  '- computing',
  'author:',
  '  name: Ada',
  '  email: ada@example.org',
].join('\n');

test.describe('the metadata of a rich-text document', () => {
  test('the info toggle shows and hides the metadata above the document', async ({
    electronApp,
    window,
    testProjectDir,
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
    const panel = metadataPanel({ window });

    await expect(panel).toHaveCount(0);

    await window.getByRole('button', { name: 'Show properties' }).click();

    await expect(panel.getByRole('term')).toHaveText([
      'title',
      'abstract',
      'draft',
      'tags',
      'author',
    ]);
    await expect(panel.getByRole('textbox', { name: 'title' })).toHaveValue(
      'Hello *world*'
    );
    await expect(panel.getByRole('textbox', { name: 'abstract' })).toHaveValue(
      'First paragraph.\n\nSecond paragraph.'
    );
    await expect(panel.getByRole('checkbox', { name: 'draft' })).toBeChecked();
    // The tags, and the nested map's summary.
    const values = panel.getByRole('definition');
    await expect(values.nth(3)).toHaveText('historycomputing');
    await expect(values.nth(4)).toHaveText('name, email');

    await window.getByRole('button', { name: 'Hide properties' }).click();

    await expect(panel).toHaveCount(0);
  });

  test('the info toggle holds after a reload', async ({
    electronApp,
    window,
    testProjectDir,
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
    await showMetadata({ window });

    await window.reload();
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await expect(metadataPanel({ window }).getByRole('term')).toHaveText([
      'title',
      'abstract',
      'draft',
      'tags',
      'author',
    ]);
  });

  test('a document without front matter shows that it has no metadata', async ({
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

    await showMetadata({ window });

    await expect(metadataPanel({ window })).toHaveText('No properties');
  });

  test("a document whose front matter isn't valid YAML shows that its metadata can't be shown", async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    fs.writeFileSync(
      path.join(testProjectDir, 'hello.md'),
      '---\ntitle: [unclosed\n---\n\n# Hello\n',
      'utf8'
    );
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await showMetadata({ window });

    await expect(metadataPanel({ window })).toHaveText(
      "The properties can't be shown here yet."
    );
  });
});

test.describe("editing a rich-text document's metadata", () => {
  // hello.md with the given front matter, open with its metadata shown.
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
    const helloPath = path.join(testProjectDir, 'hello.md');
    fs.writeFileSync(
      helloPath,
      `---\n${frontMatter}\n---\n\n# Hello\n`,
      'utf8'
    );
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });
    await showMetadata({ window });

    return {
      helloPath,
      panel: metadataPanel({ window }),
      // The file's text, for `expect.poll`.
      fileText: () => fs.readFileSync(helloPath, 'utf8'),
    };
  };

  test('toggling a boolean saves it to the file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { helloPath, panel } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ndraft: true',
    });
    const draft = panel.getByRole('checkbox', { name: 'draft' });

    await draft.click();

    await expect(draft).not.toBeChecked();
    await expect
      .poll(() => fs.readFileSync(helloPath, 'utf8'))
      .toContain('draft: false');
  });

  test("undo in the document doesn't revert a toggled boolean", async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { helloPath, panel } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ndraft: true',
    });
    const draft = panel.getByRole('checkbox', { name: 'draft' });
    await focusAndTypeInRichTextEditor({ window, text: ' world' });
    await expect(window.locator('.ProseMirror h1')).toHaveText('Hello world');
    await draft.click();
    await expect
      .poll(() => fs.readFileSync(helloPath, 'utf8'))
      .toContain('draft: false');

    await window.locator('.ProseMirror').click();
    await window.keyboard.press(`${modKey}+z`);

    await expect(window.locator('.ProseMirror h1')).toHaveText('Hello');
    await expect(draft).not.toBeChecked();
  });

  test('editing a one-line value saves it to the file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello',
    });
    const title = panel.getByRole('textbox', { name: 'title' });

    await title.fill('Hello world');
    await title.press('Enter');

    await expect(title).toHaveValue('Hello world');
    await expect.poll(fileText).toContain('title: Hello world\n');
  });

  test('editing a multi-paragraph value saves it to the file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'abstract: |\n  First paragraph.',
    });
    const abstract = panel.getByRole('textbox', { name: 'abstract' });

    await abstract.fill('First paragraph.\n\nSecond paragraph.');
    await abstract.press(`${modKey}+Enter`);

    await expect
      .poll(fileText)
      .toContain('abstract: |\n  First paragraph.\n\n  Second paragraph.\n');
  });

  test('adding and removing list items saves them to the file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'tags:\n- history\n- computing',
    });
    const newTag = panel.getByRole('textbox', { name: 'Add to tags' });

    await newTag.fill('essay');
    await newTag.press('Enter');
    await expect
      .poll(fileText)
      .toContain('tags:\n- history\n- computing\n- essay\n');

    await panel.getByRole('button', { name: 'Remove history' }).click();

    await expect.poll(fileText).toContain('tags:\n- computing\n- essay\n');

    // Backspace in the empty input removes the last item.
    await newTag.press('Backspace');

    await expect.poll(fileText).toContain('tags:\n- computing\n---');
  });

  test("a value the editor can't show is refused, with the reason", async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello',
    });
    const title = panel.getByRole('textbox', { name: 'title' });

    await title.fill('The $x^2$ title');
    await title.press('Enter');

    await expect(
      panel.getByText("The editor can't show math yet.")
    ).toBeVisible();
    await expect(title).toHaveValue('The $x^2$ title');
    expect(fileText()).toContain('title: Hello\n');
  });

  test('clearing a value or a list is refused', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ntags:\n- history',
    });
    const title = panel.getByRole('textbox', { name: 'title' });
    const refusal = panel.getByText('Use Remove to delete the property');

    await title.fill('');

    await expect(refusal).toBeVisible();

    await title.press('Enter');

    await expect(title).toHaveValue('Hello');

    await panel.getByRole('button', { name: 'Remove history' }).click();

    await expect(refusal).toBeVisible();
    expect(fileText()).toContain('title: Hello\ntags:\n- history\n');
  });

  test('Escape leaves a field without committing it', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ntags:\n- history',
    });
    const title = panel.getByRole('textbox', { name: 'title' });
    const newTag = panel.getByRole('textbox', { name: 'Add to tags' });

    await title.fill('Changed');
    await title.press('Escape');
    await newTag.fill('essay');
    await newTag.press('Escape');

    await expect(title).toHaveValue('Hello');
    await expect(newTag).toHaveValue('');

    // Edits are committed in order, so once this one is saved, a cancelled
    // edit would have been saved before it.
    await newTag.fill('computing');
    await newTag.press('Enter');
    await expect
      .poll(fileText)
      .toContain('title: Hello\ntags:\n- history\n- computing\n');
  });
});
