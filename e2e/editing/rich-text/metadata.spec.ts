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
    await expect(panel.getByRole('definition')).toHaveText([
      'Hello *world*',
      'First paragraph. Second paragraph.',
      '',
      'historycomputing',
      'name, email',
    ]);
    await expect(panel.getByRole('checkbox', { name: 'draft' })).toBeChecked();

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
  // hello.md with a draft boolean, open with its metadata shown.
  const openHelloMdWithDraft = async ({
    electronApp,
    window,
    testProjectDir,
  }: {
    electronApp: ElectronApplication;
    window: Page;
    testProjectDir: string;
  }) => {
    const helloPath = path.join(testProjectDir, 'hello.md');
    fs.writeFileSync(
      helloPath,
      '---\ntitle: Hello\ndraft: true\n---\n\n# Hello\n',
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
      draft: metadataPanel({ window }).getByRole('checkbox', { name: 'draft' }),
    };
  };

  test('toggling a boolean saves it to the file', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    const { helloPath, draft } = await openHelloMdWithDraft({
      electronApp,
      window,
      testProjectDir,
    });

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
    const { helloPath, draft } = await openHelloMdWithDraft({
      electronApp,
      window,
      testProjectDir,
    });
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
});
