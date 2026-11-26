import fs from 'fs';
import path from 'path';

import { expect, test } from '../../../shared/fixtures';
import {
  metadataPanel,
  openHelloMd,
  openProjectFolder,
  showMetadata,
} from '../../../shared/helpers';
import { metadataKeys, openHelloMdWithFrontMatter } from './helpers';

test.describe("editing the keys of a rich-text document's metadata", () => {
  test('renaming a key saves it to the file', async ({
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

  test('a key that is empty, taken or ends in _ is refused', async ({
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

  test("removing a key from its row's menu saves it to the file", async ({
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

  test.describe('adding a key', () => {
    test('adding a key saves it after the others', async ({
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
        .poll(metadataKeys({ panel }))
        .toEqual(['title', 'draft', 'subtitle']);

      await expect(
        panel.getByRole('textbox', { name: 'subtitle', exact: true })
      ).toHaveValue('World');
    });

    test('inserting a key below another saves it there', async ({
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
        .poll(metadataKeys({ panel }))
        .toEqual(['title', 'subtitle', 'draft']);
    });

    test('adding a key to a document without front matter starts it', async ({
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

    test('a new key that is refused stays, until Escape discards it', async ({
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

    test('a new key left with nothing typed is discarded', async ({
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

    test("a new key whose value the editor can't show is refused, with the reason", async ({
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
  });
});
