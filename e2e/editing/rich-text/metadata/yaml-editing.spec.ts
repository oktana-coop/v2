import { expect, test } from '../../../shared/fixtures';
import {
  modKey,
  openHelloMd,
  openProjectFolder,
  pressUndo,
} from '../../../shared/helpers';
import {
  openHelloMdWithFrontMatter,
  typeAtEndOfFirstLine,
  yamlEditor,
  yamlLines,
} from './helpers';

test.describe("editing a rich-text document's metadata as YAML", () => {
  test('editing the YAML saves it to the file with Cmd/Ctrl+Enter', async ({
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

    await panel.getByRole('button', { name: 'Edit as YAML' }).click();
    await expect
      .poll(yamlLines({ panel }))
      .toEqual(['title: Hello', 'draft: true', '']);

    await typeAtEndOfFirstLine({ window, panel, text: ' world' });
    await window.keyboard.press(`${modKey}+Enter`);

    await expect.poll(fileText).toContain('title: Hello world\ndraft: true\n');

    await expect(panel).toBeFocused();

    await panel.getByRole('button', { name: 'Edit as form' }).click();

    await expect(
      panel.getByRole('textbox', { name: 'title', exact: true })
    ).toHaveValue('Hello world');
  });

  test('leaving the YAML editor saves it to the file', async ({
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
    await typeAtEndOfFirstLine({ window, panel, text: '\ndraft: true' });

    await window.locator('.ProseMirror').click();

    await expect.poll(fileText).toContain('title: Hello\ndraft: true\n');
  });

  test("YAML that can't be saved stays with the error, until Escape sets it back", async ({
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
    await typeAtEndOfFirstLine({ window, panel, text: '\ndraft: [' });

    await window.keyboard.press(`${modKey}+Enter`);

    await expect(
      panel.getByText("This YAML can't be saved as properties.")
    ).toBeVisible();

    await expect
      .poll(yamlLines({ panel }))
      .toEqual(['title: Hello', 'draft: [', '']);

    expect(fileText()).toContain('title: Hello\n');

    await yamlEditor({ panel }).click();
    await window.keyboard.press('Escape');

    await expect.poll(yamlLines({ panel })).toEqual(['title: Hello', '']);

    // Escape's change is in the editor's undo history.
    await pressUndo({ window });

    await expect
      .poll(yamlLines({ panel }))
      .toEqual(['title: Hello', 'draft: [', '']);
  });

  test("front matter that isn't valid YAML can't be shown as a form, and is fixed as YAML", async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { panel, fileText } = await openHelloMdWithFrontMatter({
      electronApp,
      window,
      testProjectDir,
      frontMatter: 'title: [unclosed',
    });

    await expect(panel).toHaveText("The properties can't be shown as a form.");

    await panel.getByRole('button', { name: 'Edit as YAML' }).click();

    await expect.poll(yamlLines({ panel })).toEqual(['title: [unclosed', '']);

    await yamlEditor({ panel }).click();
    await window.keyboard.press(`${modKey}+a`);
    await window.keyboard.type('title: Fixed');
    await window.keyboard.press(`${modKey}+Enter`);

    await expect.poll(fileText).toContain('---\ntitle: Fixed\n---');
  });

  test('YAML mode holds after a reload', async ({
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

    await panel.getByRole('button', { name: 'Edit as YAML' }).click();

    await window.reload();
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await expect(
      panel.getByRole('button', { name: 'Edit as form' })
    ).toBeVisible();

    await expect.poll(yamlLines({ panel })).toEqual(['title: Hello', '']);
  });
});
