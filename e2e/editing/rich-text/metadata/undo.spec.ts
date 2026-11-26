import fs from 'fs';

import { expect, test } from '../../../shared/fixtures';
import {
  focusAndTypeInRichTextEditor,
  modKey,
  pressRedo,
  pressUndo,
} from '../../../shared/helpers';
import { openHelloMdWithFrontMatter, typeAtEndOfFirstLine } from './helpers';

test.describe("undo and redo of a rich-text document's metadata", () => {
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
    await pressUndo({ window });

    await expect(window.locator('.ProseMirror h1')).toHaveText('Hello');
    await expect(draft).not.toBeChecked();
  });

  test('undo and redo in the panel take back and make again a committed value', async ({
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
    await expect.poll(fileText).toContain('title: Hello world\n');
    await expect(panel).toBeFocused();

    await pressUndo({ window });

    await expect.poll(fileText).toContain('title: Hello\n');
    await expect(title).toHaveValue('Hello');

    await pressRedo({ window });

    await expect.poll(fileText).toContain('title: Hello world\n');
    await expect(title).toHaveValue('Hello world');
  });

  test('undo in the panel brings back a removed key', async ({
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
    // The row went away with the focus, which went to the panel.
    await expect(panel).toBeFocused();

    await pressUndo({ window });

    await expect
      .poll(fileText)
      .toContain('---\ntitle: Hello\ndraft: true\n---');

    await expect(panel.getByRole('checkbox', { name: 'draft' })).toBeChecked();
  });

  test('undo in a field with typing undoes the typing, not the metadata', async ({
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

    await title.fill('Hi');
    await title.press('Enter');

    await newTag.fill('essay');
    await newTag.press('Enter');
    await expect
      .poll(fileText)
      .toContain('title: Hi\ntags:\n- history\n- essay\n');

    await title.fill('Changed');
    await title.press(`${modKey}+z`);

    await expect(title).toHaveValue('Hi');

    // The panel's undo takes back only the last commit, so the one before
    // wasn't taken back with the field's undo.
    await title.press('Escape');
    await pressUndo({ window });

    await expect.poll(fileText).toContain('title: Hi\ntags:\n- history\n---');
  });

  test('undo in the form takes back a change made as YAML', async ({
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

    await panel.getByRole('button', { name: 'Edit as YAML' }).click();
    await typeAtEndOfFirstLine({ window, panel, text: ' world' });
    await window.keyboard.press(`${modKey}+Enter`);
    await expect.poll(fileText).toContain('title: Hello world\n');

    await panel.getByRole('button', { name: 'Edit as form' }).click();

    await pressUndo({ window });

    await expect.poll(fileText).toContain('title: Hello\n');

    await expect(
      panel.getByRole('textbox', { name: 'title', exact: true })
    ).toHaveValue('Hello');
  });
});
