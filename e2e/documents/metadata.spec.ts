import fs from 'fs';
import path from 'path';

import { expect, test } from '../shared/fixtures';
import { openHelloMd, openProjectFolder } from '../shared/helpers';

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
  test('the info toggle shows and hides the front matter above the document', async ({
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
    const panel = window.getByRole('region', { name: 'Properties' });

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
    await window.getByRole('button', { name: 'Show properties' }).click();

    await window.reload();
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openHelloMd({ window });

    await expect(
      window.getByRole('region', { name: 'Properties' }).getByRole('term')
    ).toHaveText(['title', 'abstract', 'draft', 'tags', 'author']);
  });

  test('a document without front matter shows that it has no properties', async ({
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

    await window.getByRole('button', { name: 'Show properties' }).click();

    await expect(window.getByRole('region', { name: 'Properties' })).toHaveText(
      'No properties'
    );
  });
});
