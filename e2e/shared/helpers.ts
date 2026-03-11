import { ElectronApplication, Page } from '@playwright/test';

/**
 * Opens a project folder in the app by:
 * 1. Mocking Electron's showOpenDialog to return the given path
 * 2. Clicking the "Open Folder" button in the UI to trigger the flow
 * 3. Waiting for the file explorer sidebar to appear
 */
export const openProjectFolder = async ({
  electronApp,
  window,
  folderPath,
}: {
  electronApp: ElectronApplication;
  window: Page;
  folderPath: string;
}): Promise<void> => {
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
    timeout: 800,
  });
};

/**
 * Mocks Electron's showSaveDialog to return a specific file path, then clicks
 * the create-file button.
 *
 * Note: this helper does NOT create the file on disk. The app itself is
 * responsible for writing the file as part of its "new document" flow — this
 * helper only drives the UI.
 */
export const createNewFile = async ({
  electronApp,
  window,
  filePath,
}: {
  electronApp: ElectronApplication;
  window: Page;
  filePath: string;
}): Promise<void> => {
  await electronApp.evaluate(async ({ dialog }, fp) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: fp,
    });
  }, filePath);

  await window.getByRole('button', { name: /new document/i }).click();

  // Wait for the editor to open for the new file
  await window.waitForSelector('.ProseMirror', { timeout: 3_000 });
};

/**
 * Mocks the main-process context-menu:show handler to auto-respond with
 * a "New File" action (bypassing the native OS menu popup that Playwright
 * cannot interact with). Also mocks showSaveDialog to return the desired
 * file path.
 */
export const createNewFileFromContextMenu = async ({
  electronApp,
  newFilePath,
}: {
  electronApp: ElectronApplication;
  newFilePath: string;
}): Promise<void> => {
  await electronApp.evaluate(async ({ dialog }, fp) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: fp,
    });
  }, newFilePath);

  await electronApp.evaluate(async ({ ipcMain, BrowserWindow }) => {
    ipcMain.removeHandler('context-menu:show');

    ipcMain.handle('context-menu:show', async (_, payload) => {
      if (
        payload.context === 'EXPLORER_TREE_NODE' &&
        payload.nodeType === 'DIRECTORY'
      ) {
        const win = BrowserWindow.getAllWindows()[0];
        win.webContents.send('context-menu:action', {
          context: 'EXPLORER_TREE_DIRECTORY',
          action: { type: 'NEW_FILE', parentPath: payload.path },
        });
      }
    });
  });
};

/**
 * Mocks the main-process context-menu:show handler to auto-respond with
 * a "New Folder" action (bypassing the native OS menu popup that Playwright
 * cannot interact with).
 */
export const createNewSubfolderFromContextMenu = async ({
  electronApp,
}: {
  electronApp: ElectronApplication;
}): Promise<void> => {
  await electronApp.evaluate(async ({ ipcMain, BrowserWindow }) => {
    ipcMain.removeHandler('context-menu:show');

    ipcMain.handle('context-menu:show', async (_, payload) => {
      if (
        payload.context === 'EXPLORER_TREE_NODE' &&
        payload.nodeType === 'DIRECTORY'
      ) {
        const win = BrowserWindow.getAllWindows()[0];
        win.webContents.send('context-menu:action', {
          context: 'EXPLORER_TREE_DIRECTORY',
          action: { type: 'NEW_DIRECTORY', parentPath: payload.path },
        });
      }
    });
  });
};

export const openHelloMd = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await window.getByText('hello').click();
  await window.waitForSelector('.ProseMirror', { timeout: 2_000 });
};

export const typeInEditor = async ({
  window,
  text,
}: {
  window: Page;
  text: string;
}): Promise<void> => {
  const editor = window.locator('.ProseMirror');
  await editor.click();
  await window.keyboard.press('End');
  await window.keyboard.type(text);
};

/**
 * There is a debounce of (at the time of writing this) 300ms as the user is typing.
 * This function waits for this debounce period before returning.
 */
export const typeInEditorAndWaitForDebounce = async ({
  window,
  text,
  waitFor = 350,
}: {
  window: Page;
  text: string;
  waitFor?: number;
}): Promise<void> => {
  await typeInEditor({ window, text });
  await window.waitForTimeout(waitFor);
};

/**
 * Clicks the commit button (CheckIcon) in the editor ActionsBar,
 * fills in the commit message, and submits the dialog.
 *
 * HeadlessUI Dialog uses CSS transitions; we wait for the textarea inside
 * the dialog rather than waiting for the dialog element itself.
 */
export const commitChanges = async ({
  window,
  message,
}: {
  window: Page;
  message: string;
}): Promise<void> => {
  // Click the commit button in either the editor or history ActionsBar
  await window.getByRole('button', { name: /commit changes/i }).click();

  // Wait for the commit message textarea to be visible (autofocused in dialog)
  const textarea = window.getByRole('textbox');
  await textarea.waitFor({ state: 'visible', timeout: 500 });
  await textarea.fill(message);

  // Click the "Commit" button in the dialog
  await window.getByRole('button', { name: /^Commit$/i }).click();

  // Wait for dialog to close (textarea disappears)
  await textarea.waitFor({ state: 'hidden', timeout: 500 });
};

export const selectUncommittedChanges = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await window.getByTestId('uncommitted-changes').click();
};

export const selectFirstCommit = async ({
  window,
  commitMessage,
}: {
  window: Page;
  commitMessage: string;
}): Promise<void> => {
  const commits = window.getByTestId('history-commit');
  await commits.filter({ hasText: commitMessage }).first().click();
};

/**
 * Clicks the "Edit Document" (PenIcon) button in the history ActionsBar
 * to return to the editor from the history view.
 */
export const returnToEditor = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await window.getByRole('button', { name: /edit document/i }).click();
  await window.waitForSelector('.ProseMirror', { timeout: 500 });
};

/**
 * With uncommitted changes selected, clicks the Discard Changes button
 * and confirms the dialog.
 *
 * HeadlessUI Dialog uses CSS transitions; we wait for the "Discard" button
 * inside the dialog rather than the dialog element itself.
 */
export const discardChanges = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await window.getByRole('button', { name: /discard changes/i }).click();

  // Wait for the Discard button inside the confirmation dialog
  const discardBtn = window.getByRole('button', { name: /^Discard$/i });
  await discardBtn.waitFor({ state: 'visible', timeout: 500 });
  await discardBtn.click();

  // Wait for dialog to close
  await discardBtn.waitFor({ state: 'hidden', timeout: 500 });
};

/**
 * Mocks the main-process context-menu:show handler to auto-respond with
 * a "Delete" action for file nodes (bypassing the native OS menu popup that
 * Playwright cannot interact with).
 */
export const deleteFileFromContextMenu = async ({
  electronApp,
}: {
  electronApp: ElectronApplication;
}): Promise<void> => {
  await electronApp.evaluate(async ({ ipcMain, BrowserWindow }) => {
    ipcMain.removeHandler('context-menu:show');

    ipcMain.handle('context-menu:show', async (_, payload) => {
      if (
        payload.context === 'EXPLORER_TREE_NODE' &&
        payload.nodeType === 'FILE'
      ) {
        const win = BrowserWindow.getAllWindows()[0];
        win.webContents.send('context-menu:action', {
          context: 'EXPLORER_TREE_FILE',
          action: { type: 'DELETE', path: payload.path },
        });
      }
    });
  });
};

/**
 * Clicks the "Delete" button in the delete-file confirmation dialog
 * and waits for the dialog to close.
 */
export const confirmDeletion = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  const deleteBtn = window.getByRole('button', { name: /^Delete$/i });
  await deleteBtn.waitFor({ state: 'visible', timeout: 500 });
  await deleteBtn.click();
  await deleteBtn.waitFor({ state: 'hidden', timeout: 500 });
};
