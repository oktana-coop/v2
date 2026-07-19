import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Page } from '@playwright/test';

import { expect, test } from '../shared/fixtures';
import {
  expectFigureImageRendered,
  openDocument,
  openProjectFolder,
  PNG_1x1,
} from '../shared/helpers';

// Documents at the project root and in a subfolder, with and without assets.
// The nested ones reference the shared asset by climbing out of their folder,
// so their srcs only resolve against the right document path.
const seedProject = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-e2e-doc-nav-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.mkdirSync(path.join(dir, 'docs'));

  fs.writeFileSync(path.join(dir, 'assets', 'diagram.png'), PNG_1x1);
  fs.writeFileSync(
    path.join(dir, 'readme.md'),
    '# Readme\n\n![](assets/diagram.png)\n'
  );
  fs.writeFileSync(
    path.join(dir, 'changelog.md'),
    '# Changelog\n\n![](assets/diagram.png)\n'
  );
  fs.writeFileSync(path.join(dir, 'notes.md'), '# Notes\n\nNo assets here.\n');
  fs.writeFileSync(
    path.join(dir, 'docs', 'architecture.md'),
    '# Architecture\n\n![](../assets/diagram.png)\n'
  );
  fs.writeFileSync(
    path.join(dir, 'docs', 'setup.md'),
    '# Setup\n\nNo assets here either.\n'
  );

  return dir;
};

// Waits for the document's own content before asserting anything else, so a
// check can't pass against the document that was open before it.
const openAndExpectContent = async ({
  window,
  relativePath,
  heading,
}: {
  window: Page;
  relativePath: string;
  heading: string;
}): Promise<void> => {
  await openDocument({ window, relativePath });
  await expect(window.locator('.ProseMirror').first()).toContainText(heading, {
    timeout: 5_000,
  });
};

const openAndExpectImageRendered = async (args: {
  window: Page;
  relativePath: string;
  heading: string;
}): Promise<void> => {
  await openAndExpectContent(args);
  await expectFigureImageRendered({ window: args.window });
};

test.describe('document navigation', () => {
  test('renders the first document opened, from a subfolder', async ({
    electronApp,
    window,
  }) => {
    const dir = seedProject();
    await openProjectFolder({ electronApp, window, folderPath: dir });

    await openAndExpectImageRendered({
      window,
      relativePath: 'docs/architecture.md',
      heading: 'Architecture',
    });
  });

  test('renders a second root-level document', async ({
    electronApp,
    window,
  }) => {
    const dir = seedProject();
    await openProjectFolder({ electronApp, window, folderPath: dir });

    await openAndExpectImageRendered({
      window,
      relativePath: 'readme.md',
      heading: 'Readme',
    });
    await openAndExpectImageRendered({
      window,
      relativePath: 'changelog.md',
      heading: 'Changelog',
    });
  });

  test('renders a document in a subfolder opened after a root one', async ({
    electronApp,
    window,
  }) => {
    const dir = seedProject();
    await openProjectFolder({ electronApp, window, folderPath: dir });

    await openAndExpectImageRendered({
      window,
      relativePath: 'readme.md',
      heading: 'Readme',
    });
    await openAndExpectImageRendered({
      window,
      relativePath: 'docs/architecture.md',
      heading: 'Architecture',
    });
  });

  // The reverse direction: a root document's asset srcs must not be resolved
  // against the subfolder document that preceded it.
  test('renders a root document opened after one in a subfolder', async ({
    electronApp,
    window,
  }) => {
    const dir = seedProject();
    await openProjectFolder({ electronApp, window, folderPath: dir });

    await openAndExpectImageRendered({
      window,
      relativePath: 'docs/architecture.md',
      heading: 'Architecture',
    });
    await openAndExpectImageRendered({
      window,
      relativePath: 'readme.md',
      heading: 'Readme',
    });
  });

  // Returning to a document that was resolved earlier is the case most likely
  // to read a stale artifact rather than re-resolving the current one.
  test('renders a document returned to after visiting another', async ({
    electronApp,
    window,
  }) => {
    const dir = seedProject();
    await openProjectFolder({ electronApp, window, folderPath: dir });

    await openAndExpectImageRendered({
      window,
      relativePath: 'readme.md',
      heading: 'Readme',
    });
    await openAndExpectImageRendered({
      window,
      relativePath: 'docs/architecture.md',
      heading: 'Architecture',
    });
    await openAndExpectImageRendered({
      window,
      relativePath: 'readme.md',
      heading: 'Readme',
    });
  });

  test('renders a document without assets between two that have them', async ({
    electronApp,
    window,
  }) => {
    const dir = seedProject();
    await openProjectFolder({ electronApp, window, folderPath: dir });

    await openAndExpectImageRendered({
      window,
      relativePath: 'readme.md',
      heading: 'Readme',
    });
    await openAndExpectContent({
      window,
      relativePath: 'notes.md',
      heading: 'Notes',
    });
    await openAndExpectImageRendered({
      window,
      relativePath: 'changelog.md',
      heading: 'Changelog',
    });
  });

  test('renders documents when moving between two subfolder documents', async ({
    electronApp,
    window,
  }) => {
    const dir = seedProject();
    await openProjectFolder({ electronApp, window, folderPath: dir });

    await openAndExpectContent({
      window,
      relativePath: 'docs/setup.md',
      heading: 'Setup',
    });
    await openAndExpectImageRendered({
      window,
      relativePath: 'docs/architecture.md',
      heading: 'Architecture',
    });
  });

  // A reload puts the renderer back to a cold start, where resolution races
  // the (now warm) content pipeline differently than on later navigations.
  test('renders a document with an image after reloading the app', async ({
    electronApp,
    window,
  }) => {
    const dir = seedProject();
    await openProjectFolder({ electronApp, window, folderPath: dir });

    await openAndExpectImageRendered({
      window,
      relativePath: 'readme.md',
      heading: 'Readme',
    });

    await window.reload();
    await openProjectFolder({ electronApp, window, folderPath: dir });

    await openAndExpectImageRendered({
      window,
      relativePath: 'docs/architecture.md',
      heading: 'Architecture',
    });
  });
});
