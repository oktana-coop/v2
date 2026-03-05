import { ElectronApplication, Page } from '@playwright/test';

/**
 * Opens a project folder in the app by:
 * 1. Mocking Electron's showOpenDialog to return the given path
 * 2. Clicking the "Open Folder" button in the UI to trigger the flow
 * 3. Waiting for the file explorer sidebar to appear
 */
export async function openProjectFolder(
  electronApp: ElectronApplication,
  window: Page,
  folderPath: string
): Promise<void> {
  // Mock the native dialog before clicking so no system dialog appears
  await electronApp.evaluate(async ({ dialog }, dirPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [dirPath],
    });
  }, folderPath);

  // Click the button that triggers openDirectory
  await window
    .getByRole('button', { name: /open folder/i })
    .first()
    .click();

  // Wait for the sidebar / file tree to appear — confirms project is loaded
  await window.waitForSelector('[data-testid="file-explorer"]', {
    timeout: 20_000,
  });
}
