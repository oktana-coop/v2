import { type Locator, type Page } from '@playwright/test';

import {
  joinFromButton,
  shareFromCommandPalette,
} from '../collaboration/helpers';
import {
  createMergeConflictForDocument,
  seedDocument,
} from '../merge-conflicts/helpers';
import { expect, test } from '../shared/fixtures';
import {
  navigateToSettings,
  openCommandPalette,
  openHelloMd,
  openProjectFolder,
  selectUncommittedChanges,
  typeInParagraphAndWaitForDebounce,
} from '../shared/helpers';

// Hides the sidebar with the actions bar's toggle, then shows it again.
const expectSidebarToToggle = async ({
  window,
  sidebar,
}: {
  window: Page;
  sidebar: Locator;
}) => {
  await expect(sidebar).toBeVisible();

  await window
    .getByRole('button', { name: 'Hide Sidebar', exact: true })
    .click();
  await expect(sidebar).not.toBeVisible();

  await window
    .getByRole('button', { name: 'Show Sidebar', exact: true })
    .click();
  await expect(sidebar).toBeVisible();
};

const runPaletteOption = async ({
  window,
  name,
}: {
  window: Page;
  name: string;
}) => {
  await openCommandPalette({ window });
  // An option's name also holds its shortcut keys.
  const option = window.getByRole('option', { name });
  await option.waitFor({ state: 'visible', timeout: 2_000 });
  await option.click();
};

test.describe('hiding and showing the sidebar', () => {
  test.describe('project pages', () => {
    test('the documents view with no document open', async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      await openProjectFolder({
        electronApp,
        window,
        folderPath: testProjectDir,
      });

      await expectSidebarToToggle({
        window,
        sidebar: window.getByTestId('file-explorer'),
      });
    });

    test('the document editor', async ({
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

      await expectSidebarToToggle({
        window,
        sidebar: window.getByTestId('file-explorer'),
      });
    });

    test("a document's history view", async ({
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
      await typeInParagraphAndWaitForDebounce({ window, text: ' edited' });
      await selectUncommittedChanges({ window });
      await window.waitForSelector('.ProseMirror[contenteditable="false"]', {
        timeout: 5_000,
      });

      await expectSidebarToToggle({
        window,
        sidebar: window.getByTestId('file-explorer'),
      });
    });

    test('an unsupported file', async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      await openProjectFolder({
        electronApp,
        window,
        folderPath: testProjectDir,
      });
      await window.getByText('config.json').click();
      await expect(window.getByText('Preview not available')).toBeVisible({
        timeout: 5_000,
      });

      await expectSidebarToToggle({
        window,
        sidebar: window.getByTestId('file-explorer'),
      });
    });

    test('print preview', async ({ electronApp, window, testProjectDir }) => {
      await openProjectFolder({
        electronApp,
        window,
        folderPath: testProjectDir,
      });
      await openHelloMd({ window });
      await runPaletteOption({ window, name: 'Print Preview' });
      await expect(window).toHaveTitle(/Print Preview/i, { timeout: 2_000 });

      await expectSidebarToToggle({
        window,
        sidebar: window.getByTestId('file-explorer'),
      });
    });

    test('project settings', async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      await openProjectFolder({
        electronApp,
        window,
        folderPath: testProjectDir,
      });
      await runPaletteOption({ window, name: 'Open Project Settings' });

      await expectSidebarToToggle({
        window,
        sidebar: window.getByTestId('file-explorer'),
      });
    });
  });

  test.describe('merge conflicts', () => {
    test.slow();

    test('the conflict resolution page', async ({
      electronApp,
      window,
      emptyProjectDir,
    }) => {
      const relativePath = 'Bar.md';
      seedDocument({ projectDir: emptyProjectDir, relativePath });
      await openProjectFolder({
        electronApp,
        window,
        folderPath: emptyProjectDir,
      });
      await createMergeConflictForDocument({ window, relativePath });

      await expectSidebarToToggle({
        window,
        sidebar: window.getByRole('heading', {
          name: 'Merge Conflicts',
          exact: true,
        }),
      });
    });
  });

  test.describe('app settings', () => {
    test('the settings page', async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      await openProjectFolder({
        electronApp,
        window,
        folderPath: testProjectDir,
      });
      await navigateToSettings({ window });

      await expectSidebarToToggle({
        window,
        sidebar: window.getByRole('link', { name: 'Appearance', exact: true }),
      });
    });
  });

  test.describe('shared documents', () => {
    test.use({ withSyncServer: true });

    test('the shared documents list and the guest editor', async ({
      electronApp,
      window,
      testProjectDir,
    }) => {
      test.setTimeout(120_000);

      await openProjectFolder({
        electronApp,
        window,
        folderPath: testProjectDir,
      });
      await openHelloMd({ window });
      const shareId = await shareFromCommandPalette({ window });
      await runPaletteOption({ window, name: 'Shared with me' });

      const sharedWithMe = window.getByTestId('guest-shares');
      await expectSidebarToToggle({ window, sidebar: sharedWithMe });

      await joinFromButton({ window, shareId });
      await expect(window.locator('.ProseMirror')).toContainText(
        'This is a test document',
        { timeout: 20_000 }
      );

      await expectSidebarToToggle({ window, sidebar: sharedWithMe });
    });
  });
});
