import { expect, test } from '../shared/fixtures';
import { clickSettingsTab, navigateToSettings } from '../shared/helpers';
import {
  getOpenedExternalLinks,
  type GithubDeviceFlowMock,
  installGithubDeviceFlowMock,
  readMainClipboard,
  uninstallGithubDeviceFlowMock,
} from './mock';

const userCode = 'WDJB-MJHT';
const verificationUri = 'https://example.com/device';

test.describe('GitHub device flow dialog', () => {
  let mock: GithubDeviceFlowMock;

  test.beforeEach(async ({ electronApp }) => {
    mock = await installGithubDeviceFlowMock(electronApp, {
      userCode,
      verificationUri,
    });
    // Clear the clipboard so post-click assertions start from a known state.
    await electronApp.evaluate(({ clipboard }) => clipboard.writeText(''));
  });

  test.afterEach(async () => {
    await uninstallGithubDeviceFlowMock(mock);
  });

  test('copy writes user code to clipboard and Open GitHub triggers external link', async ({
    electronApp,
    window,
  }) => {
    await navigateToSettings({ window });
    await clickSettingsTab({ window, tabName: 'Sync' });

    await window.getByRole('button', { name: 'Connect' }).click();

    await expect(window.getByText('GitHub Integration')).toBeVisible();
    const copyButton = window.getByRole('button', {
      name: new RegExp(userCode),
    });
    await expect(copyButton).toBeVisible();

    await copyButton.click();
    await expect
      .poll(() => readMainClipboard(electronApp), { timeout: 2_000 })
      .toBe(userCode);

    await window.getByRole('link', { name: /Open GitHub/ }).click();
    await expect
      .poll(() => getOpenedExternalLinks(mock), { timeout: 2_000 })
      .toContain(verificationUri);
  });

  test('Cancel closes the dialog', async ({ window }) => {
    await navigateToSettings({ window });
    await clickSettingsTab({ window, tabName: 'Sync' });

    await window.getByRole('button', { name: 'Connect' }).click();

    const dialogTitle = window.getByText('GitHub Integration');
    await expect(dialogTitle).toBeVisible();

    await window.getByRole('button', { name: 'Cancel' }).click();

    // Dialog only hides after the cancel IPC round-trip clears the verification
    // info, so this implicitly exercises the full cancellation path.
    await expect(dialogTitle).toBeHidden();
  });
});
