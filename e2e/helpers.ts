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
    timeout: 5_000,
  });
}

/**
 * Mocks Electron's showSaveDialog to return a specific file path, then clicks
 * the create-file button. The app writes the new file to disk at filePath and
 * navigates to the editor for it.
 */
export async function createNewFile(
  electronApp: ElectronApplication,
  window: Page,
  filePath: string
): Promise<void> {
  await electronApp.evaluate(async ({ dialog }, fp) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: fp,
    });
  }, filePath);

  await window.getByRole('button', { name: /new document/i }).click();

  // Wait for the editor to open for the new file
  await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
}

/**
 * Opens hello.md in the editor from the file explorer.
 */
export async function openHelloMd(window: Page): Promise<void> {
  await window.getByText('hello').click();
  await window.waitForSelector('.ProseMirror', { timeout: 2_000 });
}

/**
 * Clicks the commit button (CheckIcon) in the editor ActionsBar,
 * fills in the commit message, and submits the dialog.
 *
 * HeadlessUI Dialog uses CSS transitions; we wait for the textarea inside
 * the dialog rather than waiting for the dialog element itself.
 */
export async function commitChanges(
  window: Page,
  message: string
): Promise<void> {
  // Click the commit button in either the editor or history ActionsBar
  await window.getByRole('button', { name: /commit changes/i }).click();

  // Wait for the commit message textarea to be visible (autofocused in dialog)
  const textarea = window.getByRole('textbox');
  await textarea.waitFor({ state: 'visible', timeout: 2_000 });
  await textarea.fill(message);

  // Click the "Commit" button in the dialog
  await window.getByRole('button', { name: /^Commit$/i }).click();

  // Wait for dialog to close (textarea disappears)
  await textarea.waitFor({ state: 'hidden', timeout: 3_000 });
}

/**
 * Clicks the "Uncommited changes" entry in the document history sidebar.
 */
export async function selectUncommittedChanges(window: Page): Promise<void> {
  await window.getByTestId('uncommitted-changes').click();
}

/**
 * Clicks a commit entry by its message text in the document history sidebar.
 */
export async function selectHistoryCommit(
  window: Page,
  commitMessage: string
): Promise<void> {
  const commits = window.getByTestId('history-commit');
  await commits.filter({ hasText: commitMessage }).first().click();
}

/**
 * Clicks the "Edit Document" (PenIcon) button in the history ActionsBar
 * to return to the editor from the history view.
 */
export async function returnToEditor(window: Page): Promise<void> {
  await window.getByRole('button', { name: /edit document/i }).click();
  await window.waitForSelector('.ProseMirror', { timeout: 2_000 });
}

/**
 * With uncommitted changes selected, clicks the Discard Changes button
 * and confirms the dialog.
 *
 * HeadlessUI Dialog uses CSS transitions; we wait for the "Discard" button
 * inside the dialog rather than the dialog element itself.
 */
export async function discardChanges(window: Page): Promise<void> {
  await window.getByRole('button', { name: /discard changes/i }).click();

  // Wait for the Discard button inside the confirmation dialog
  const discardBtn = window.getByRole('button', { name: /^Discard$/i });
  await discardBtn.waitFor({ state: 'visible', timeout: 2_000 });
  await discardBtn.click();

  // Wait for dialog to close
  await discardBtn.waitFor({ state: 'hidden', timeout: 3_000 });
}
