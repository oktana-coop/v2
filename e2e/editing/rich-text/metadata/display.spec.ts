import fs from 'fs';
import path from 'path';

import { expect, test } from '../../../shared/fixtures';
import {
  metadataPanel,
  openHelloMd,
  openProjectFolder,
  showMetadata,
} from '../../../shared/helpers';
import { metadataKeys } from './helpers';

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

    await expect
      .poll(metadataKeys({ panel }))
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
      .poll(metadataKeys({ panel: metadataPanel({ window }) }))
      .toEqual(['title', 'abstract', 'draft', 'tags', 'author']);
  });

  test('a document without front matter shows only the "Add property" button', async ({
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
});
