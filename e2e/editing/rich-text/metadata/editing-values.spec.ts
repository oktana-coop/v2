import fs from 'fs';

import { expect, test } from '../../../shared/fixtures';
import { modKey } from '../../../shared/helpers';
import { openHelloMdWithFrontMatter } from './helpers';

test.describe("editing the values of a rich-text document's metadata", () => {
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

  test.describe("changing a value's kind", () => {
    test('changing a one-line value to a list saves it to the file', async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      const { panel, fileText } = await openHelloMdWithFrontMatter({
        electronApp,
        window,
        testProjectDir,
        frontMatter: 'subject: history\ndraft: true',
      });

      await panel.getByRole('button', { name: 'Options for subject' }).click();
      await window.getByRole('menuitem', { name: 'Change to list' }).click();

      await expect
        .poll(fileText)
        .toContain('---\nsubject:\n- history\ndraft: true\n---');

      await expect(
        panel.getByRole('textbox', { name: 'subject', exact: true })
      ).toHaveCount(0);
    });

    test('changing a list to text saves its items joined to the file', async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      const { panel, fileText } = await openHelloMdWithFrontMatter({
        electronApp,
        window,
        testProjectDir,
        frontMatter: 'tags:\n- history\n- computing\ndraft: true',
      });

      await panel.getByRole('button', { name: 'Options for tags' }).click();
      await window.getByRole('menuitem', { name: 'Change to text' }).click();

      await expect
        .poll(fileText)
        .toContain('---\ntags: history, computing\ndraft: true\n---');

      await expect(
        panel.getByRole('textbox', { name: 'tags', exact: true })
      ).toHaveValue('history, computing');
    });

    test("a row's menu offers only the change of kind that fits its value", async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      const { panel } = await openHelloMdWithFrontMatter({
        electronApp,
        window,
        testProjectDir,
        frontMatter: [
          'title: Hello',
          'abstract: |',
          '  First.',
          '',
          '  Second.',
          'draft: true',
          'tags:',
          '- history',
        ].join('\n'),
      });
      const changeToList = window.getByRole('menuitem', {
        name: 'Change to list',
      });
      const changeToText = window.getByRole('menuitem', {
        name: 'Change to text',
      });
      // The changes each row's menu offers.
      const changesOffered = async (key: string) => {
        await panel.getByRole('button', { name: `Options for ${key}` }).click();
        await expect(
          window.getByRole('menuitem', { name: 'Remove' })
        ).toBeVisible();

        const offered = {
          toList: await changeToList.count(),
          toText: await changeToText.count(),
        };

        await window.keyboard.press('Escape');
        await expect(window.getByRole('menuitem')).toHaveCount(0);

        return offered;
      };

      expect(await changesOffered('title')).toEqual({ toList: 1, toText: 0 });
      expect(await changesOffered('abstract')).toEqual({
        toList: 0,
        toText: 0,
      });
      expect(await changesOffered('draft')).toEqual({ toList: 0, toText: 0 });
      expect(await changesOffered('tags')).toEqual({ toList: 0, toText: 1 });
    });
  });
});
