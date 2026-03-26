import { type Page } from '@playwright/test';

import { expect, test } from '../shared/fixtures';
import {
  navigateToProjectHistory,
  openHelloMd,
  openProjectFolder,
} from '../shared/helpers';

const navigateToOptions = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await window
    .getByTestId('nav-bar')
    .getByRole('link', { name: /options/i })
    .click();
  await expect(window).toHaveTitle(/options/i, { timeout: 2_000 });
};

const navigateToEdit = async ({ window }: { window: Page }): Promise<void> => {
  await window
    .getByTestId('nav-bar')
    .getByRole('link', { name: /edit/i })
    .click();
  await window.waitForSelector('[data-testid="file-explorer"]', {
    timeout: 2_000,
  });
};

test.describe('multi-document project navigation', () => {
  test('navigating from options to project history loads the history view', async ({
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

    await navigateToOptions({ window });

    const historyHref = await window
      .getByTestId('nav-bar')
      .getByRole('link', { name: /history/i })
      .getAttribute('href');

    expect(historyHref).toContain(
      `/projects/${encodeURIComponent(testProjectDir)}/history`
    );

    await navigateToProjectHistory({ window });

    await expect(window.getByTestId('commit-history-panel')).toBeVisible();
  });

  test('navigating from options to edit view loads the editor', async ({
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

    await navigateToOptions({ window });

    const editHref = await window
      .getByTestId('nav-bar')
      .getByRole('link', { name: /edit/i })
      .getAttribute('href');

    expect(editHref).toContain(
      `/projects/${encodeURIComponent(testProjectDir)}/documents`
    );

    await navigateToEdit({ window });

    await expect(window.getByTestId('file-explorer')).toBeVisible();
  });
});
