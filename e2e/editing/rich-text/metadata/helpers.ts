import {
  type ElectronApplication,
  type Locator,
  type Page,
} from '@playwright/test';
import fs from 'fs';
import path from 'path';

import {
  documentStartKey,
  metadataPanel,
  openHelloMd,
  openProjectFolder,
  showMetadata,
} from '../../../shared/helpers';

// hello.md with the given front matter, open with its metadata shown.
export const openHelloMdWithFrontMatter = async ({
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
  fs.writeFileSync(helloPath, `---\n${frontMatter}\n---\n\n# Hello\n`, 'utf8');
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

// The keys the form shows, in order, for `expect.poll`.
export const metadataKeys =
  ({ panel }: { panel: Locator }) =>
  () =>
    panel
      .getByRole('textbox', { name: /^Name of / })
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value)
      );

export const yamlEditor = ({ panel }: { panel: Locator }) =>
  panel.locator('.cm-content');

// The YAML editor's lines, for `expect.poll`.
export const yamlLines =
  ({ panel }: { panel: Locator }) =>
  () =>
    yamlEditor({ panel }).locator('.cm-line').allTextContents();

export const typeAtEndOfFirstLine = async ({
  window,
  panel,
  text,
}: {
  window: Page;
  panel: Locator;
  text: string;
}) => {
  await yamlEditor({ panel }).click();
  await window.keyboard.press(documentStartKey);
  await window.keyboard.press('End');
  await window.keyboard.type(text);
};
