import {
  type ElectronApplication,
  type Locator,
  type Page,
} from '@playwright/test';
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

// The names the form shows, in order, for `expect.poll`.
const propertyNames =
  ({ panel }: { panel: Locator }) =>
  () =>
    panel
      .getByRole('textbox', { name: /^Name of / })
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value)
      );

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

    await expect
      .poll(propertyNames({ panel }))
      .toEqual(['title', 'abstract', 'draft', 'tags', 'author']);
    await expect(
      panel.getByRole('textbox', { name: 'title', exact: true })
    ).toHaveValue('Hello *world*');
    await expect(
      panel.getByRole('textbox', { name: 'abstract', exact: true })
    ).toHaveValue('First paragraph.\n\nSecond paragraph.');
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

    await expect
      .poll(propertyNames({ panel: metadataPanel({ window }) }))
      .toEqual(['title', 'abstract', 'draft', 'tags', 'author']);
  });

  test('a document without front matter shows only the button to add a property', async ({
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

    await expect(metadataPanel({ window })).toHaveText('Add property');
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
    const title = panel.getByRole('textbox', { name: 'title', exact: true });

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
    const abstract = panel.getByRole('textbox', {
      name: 'abstract',
      exact: true,
    });

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
    const title = panel.getByRole('textbox', { name: 'title', exact: true });

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
    const title = panel.getByRole('textbox', { name: 'title', exact: true });
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
    const title = panel.getByRole('textbox', { name: 'title', exact: true });
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

  test('renaming a property saves it to the file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ndraft: true',
    });
    const name = panel.getByRole('textbox', { name: 'Name of draft' });

    await name.fill('published');
    await name.press('Enter');

    await expect
      .poll(fileText)
      .toContain('---\ntitle: Hello\npublished: true\n---');
    await expect(
      panel.getByRole('checkbox', { name: 'published' })
    ).toBeChecked();
  });

  test('a name that is empty, taken or ends in _ is refused', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ndraft: true',
    });
    const name = panel.getByRole('textbox', { name: 'Name of draft' });

    await name.fill('');
    await expect(panel.getByText('A property needs a name')).toBeVisible();

    await name.fill('title');
    await expect(
      panel.getByText("There's already a property named “title”")
    ).toBeVisible();

    await name.fill('draft_');
    await expect(
      panel.getByText("Names ending in _ aren't kept")
    ).toBeVisible();

    await name.press('Enter');

    await expect(name).toHaveValue('draft');
    expect(fileText()).toContain('---\ntitle: Hello\ndraft: true\n---');
  });

  test('removing a property from its menu saves it to the file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ndraft: true',
    });

    await panel.getByRole('button', { name: 'Options for draft' }).click();
    await window.getByRole('menuitem', { name: 'Remove' }).click();

    await expect.poll(fileText).toContain('---\ntitle: Hello\n---');
    await expect(panel.getByRole('checkbox', { name: 'draft' })).toHaveCount(0);
  });

  test('adding a property saves it after the others', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ndraft: true',
    });
    const newName = panel.getByRole('textbox', {
      name: 'Name of the new property',
    });
    const newValue = panel.getByRole('textbox', {
      name: 'Value of the new property',
    });

    await panel.getByRole('button', { name: 'Add property' }).click();
    await expect(newName).toBeFocused();
    await newName.fill('subtitle');
    await newName.press('Enter');
    await expect(newValue).toBeFocused();
    await newValue.fill('World');
    await newValue.press('Enter');

    await expect
      .poll(fileText)
      .toContain('---\ntitle: Hello\ndraft: true\nsubtitle: World\n---');
    await expect
      .poll(propertyNames({ panel }))
      .toEqual(['title', 'draft', 'subtitle']);
    await expect(
      panel.getByRole('textbox', { name: 'subtitle', exact: true })
    ).toHaveValue('World');
  });

  test('inserting a property below another saves it there', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ndraft: true',
    });
    const newName = panel.getByRole('textbox', {
      name: 'Name of the new property',
    });
    const newValue = panel.getByRole('textbox', {
      name: 'Value of the new property',
    });

    await panel.getByRole('button', { name: 'Options for title' }).click();
    await window.getByRole('menuitem', { name: 'Insert below' }).click();
    await expect(newName).toBeFocused();
    await newName.fill('subtitle');
    await newValue.fill('World');
    await newValue.press('Enter');

    await expect
      .poll(fileText)
      .toContain('---\ntitle: Hello\nsubtitle: World\ndraft: true\n---');
    await expect
      .poll(propertyNames({ panel }))
      .toEqual(['title', 'subtitle', 'draft']);
  });

  test('adding a property to a document without front matter starts it', async ({
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
    const panel = metadataPanel({ window });
    const newValue = panel.getByRole('textbox', {
      name: 'Value of the new property',
    });

    await panel.getByRole('button', { name: 'Add property' }).click();
    await panel
      .getByRole('textbox', { name: 'Name of the new property' })
      .fill('title');
    await newValue.fill('Hello');
    await newValue.press('Enter');

    await expect
      .poll(() =>
        fs.readFileSync(path.join(testProjectDir, 'hello.md'), 'utf8')
      )
      .toMatch(/^---\ntitle: Hello\n---\n/);
  });

  test('a new property whose name is refused stays, until Escape discards it', async ({
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
    const newName = panel.getByRole('textbox', {
      name: 'Name of the new property',
    });
    const newValue = panel.getByRole('textbox', {
      name: 'Value of the new property',
    });

    await panel.getByRole('button', { name: 'Add property' }).click();
    await newName.fill('title');
    await newValue.fill('World');
    await newValue.press('Enter');

    await expect(
      panel.getByText("There's already a property named “title”")
    ).toBeVisible();
    await expect(newValue).toHaveValue('World');

    await newName.press('Escape');

    await expect(newName).toHaveCount(0);
    expect(fileText()).toContain('---\ntitle: Hello\n---');
  });

  test('a new property left with nothing typed is discarded', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello',
    });
    const newName = panel.getByRole('textbox', {
      name: 'Name of the new property',
    });

    await panel.getByRole('button', { name: 'Add property' }).click();
    await expect(newName).toBeFocused();
    await newName.blur();

    await expect(newName).toHaveCount(0);
  });

  test("a new property whose value the editor can't show is refused, with the reason", async ({
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
    const newValue = panel.getByRole('textbox', {
      name: 'Value of the new property',
    });

    await panel.getByRole('button', { name: 'Add property' }).click();
    await panel
      .getByRole('textbox', { name: 'Name of the new property' })
      .fill('subtitle');
    await newValue.fill('The $x^2$ subtitle');
    await newValue.press('Enter');

    await expect(
      panel.getByText("The editor can't show math yet.")
    ).toBeVisible();
    await expect(newValue).toHaveValue('The $x^2$ subtitle');
    expect(fileText()).toContain('---\ntitle: Hello\n---');
  });

  test('the menu button hides again once its menu closes', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: Hello\ndraft: true',
    });
    const menuButton = panel.getByRole('button', { name: 'Options for draft' });
    const remove = window.getByRole('menuitem', { name: 'Remove' });

    await menuButton.click();
    await expect(remove).toBeVisible();
    // Closed with the mouse, the menu leaves the focus on its button.
    await menuButton.click();
    await expect(remove).toHaveCount(0);
    // Away from the rows, to the panel's empty margin.
    const box = await panel.boundingBox();
    await window.mouse.move((box?.x ?? 0) + 4, (box?.y ?? 0) + 4);

    await expect(menuButton).toHaveCSS('opacity', '0');
  });
});
