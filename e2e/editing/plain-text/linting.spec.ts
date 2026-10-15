import { type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, test } from '../../shared/fixtures';
import {
  lintErrorUnderlines,
  modKey,
  openPlainTextDocument,
  openProjectFolder,
  typeAtEndOfPlainTextDocument,
} from '../../shared/helpers';

// The markers in the gutter beside lines with errors.
const lintErrorMarkers = ({ window }: { window: Page }) =>
  window.locator('.cm-lint-marker-error');

// The messages the lint panel lists, one per diagnostic.
const lintMessages = ({ window }: { window: Page }) =>
  window.locator('.cm-panel-lint .cm-diagnosticText');

const openLintPanel = async ({ window }: { window: Page }): Promise<void> => {
  // TODO: Lowercase `m` with Shift runs Ctrl+M; match shortcuts regardless of case.
  await window.keyboard.press(`${modKey}+Shift+M`);
};

test.describe('YAML', () => {
  test("shows the parser's errors in the text and the gutter", async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    fs.writeFileSync(path.join(testProjectDir, 'config.yaml'), 'name: v2\n');
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'config.yaml' });

    await typeAtEndOfPlainTextDocument({ window, text: 'name: again' });

    await expect(lintErrorUnderlines({ window })).toBeVisible({
      timeout: 5_000,
    });
    await expect(lintErrorMarkers({ window })).toBeVisible();

    await openLintPanel({ window });

    await expect(lintMessages({ window })).toHaveText([
      'Map keys must be unique',
    ]);
  });

  test('clears the errors once the YAML is valid again', async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    fs.writeFileSync(path.join(testProjectDir, 'config.yaml'), 'name: v2\n');
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'config.yaml' });

    await typeAtEndOfPlainTextDocument({ window, text: 'name: again' });
    await expect(lintErrorUnderlines({ window })).toBeVisible({
      timeout: 5_000,
    });

    await window.keyboard.press(`${modKey}+z`);

    await expect(lintErrorUnderlines({ window })).toHaveCount(0, {
      timeout: 5_000,
    });
    await expect(lintErrorMarkers({ window })).toHaveCount(0);
  });
});

test.describe('JSON', () => {
  test("shows the parser's errors in the text and the gutter", async ({
    electronApp,
    window,
    testProjectDir,
  }) => {
    fs.writeFileSync(
      path.join(testProjectDir, 'package.json'),
      '{\n  "name": \n}\n'
    );
    await openProjectFolder({
      electronApp,
      window,
      folderPath: testProjectDir,
    });
    await openPlainTextDocument({ window, name: 'package.json' });

    await expect(lintErrorUnderlines({ window })).toBeVisible({
      timeout: 5_000,
    });
    await expect(lintErrorMarkers({ window })).toBeVisible();

    await window.locator('.cm-content').click();
    await openLintPanel({ window });

    await expect(lintMessages({ window })).toHaveText(['Expected a value']);
  });
});
