import { ElectronApplication, Page } from '@playwright/test';
import * as os from 'os';

/**
 * Returns the platform-appropriate modifier key for keyboard shortcuts.
 * macOS uses Meta (Cmd), Linux/Windows use Control.
 */
export const modKey = os.platform() === 'darwin' ? 'Meta' : 'Control';

/**
 * Returns the platform-appropriate key for triggering rename in the file tree.
 * macOS uses Enter (like Finder), Linux/Windows use F2 (like File Explorer).
 */
export const renameKey = os.platform() === 'darwin' ? 'Enter' : 'F2';

/**
 * Returns the platform-appropriate shortcut for deleting a file/folder in the tree.
 * macOS uses Cmd+Backspace, Linux/Windows use Ctrl+Backspace.
 */
export const deleteKey = `${modKey}+Backspace`;

/**
 * Returns the platform-appropriate shortcut for creating a new file.
 * macOS uses Cmd+N, Linux/Windows use Ctrl+N.
 */
export const newFileKey = `${modKey}+n`;

/**
 * Returns the platform-appropriate shortcut for creating a new folder.
 * macOS uses Cmd+Option+N, Linux/Windows use Ctrl+Alt+N.
 */
export const newFolderKey = `${modKey}+Alt+n`;

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
 * Mocks Electron's showSaveDialog so the next "new document" flow
 * (button click, keyboard shortcut, or context menu) will create a file
 * at the given path without showing the native OS dialog.
 */
export const mockCreateNewFile = async ({
  electronApp,
  filePath,
}: {
  electronApp: ElectronApplication;
  filePath: string;
}): Promise<void> => {
  await electronApp.evaluate(async ({ dialog }, fp) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: fp,
    });
  }, filePath);
};

/**
 * Prepares a new file via {@link mockCreateNewFile}, then clicks the
 * "New Document" button and waits for the editor to open.
 */
export const createNewFileFromButton = async ({
  electronApp,
  window,
  filePath,
}: {
  electronApp: ElectronApplication;
  window: Page;
  filePath: string;
}): Promise<void> => {
  await mockCreateNewFile({ electronApp, filePath });

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
  await mockCreateNewFile({ electronApp, filePath: newFilePath });

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
 * Types text in the editor with a simulated delay between keystrokes,
 * mimicking real user typing behavior.
 */
export const typeInEditorSlowly = async ({
  window,
  text,
  delay = 50,
}: {
  window: Page;
  text: string;
  delay?: number;
}): Promise<void> => {
  const editor = window.locator('.ProseMirror');
  await editor.click();
  await window.keyboard.press('End');
  await window.keyboard.type(text, { delay });
};

/**
 * Clears all content in the ProseMirror editor by selecting all and deleting.
 */
export const clearEditor = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  const editor = window.locator('.ProseMirror');
  await editor.click();
  await window.keyboard.press(`${modKey}+a`);
  await window.keyboard.press('Backspace');
};

/**
 * Returns the inner HTML of the ProseMirror editor.
 */
export const getEditorHTML = async ({
  window,
}: {
  window: Page;
}): Promise<string> => {
  const editor = window.locator('.ProseMirror');
  return editor.innerHTML();
};

/**
 * Opens the editor toolbar by clicking the "Toggle Toolbar" button.
 *
 * Note: The toolbar uses absolute positioning with a CSS transition
 * (bottom: -3rem → bottom: 1rem) inside an overflow-hidden container.
 * Playwright may not consider the toolbar buttons "visible" due to
 * clipping. Use clickToolbarButton() to interact with toolbar buttons.
 */
export const openEditorToolbar = async ({
  window,
}: {
  window: Page;
}): Promise<void> => {
  await window.getByRole('button', { name: /toggle toolbar/i }).click();
};

/**
 * Clicks a toolbar button by its aria-label.
 *
 * The toolbar is inside an overflow-hidden container (may be clipped) and
 * the editor may remount due to debounce save cycles (destroying toolbar
 * elements temporarily). This helper retries the click to handle both issues.
 */
export const clickToolbarButton = async ({
  window,
  label,
}: {
  window: Page;
  label: string;
}): Promise<void> => {
  await window.getByRole('button', { name: label }).click();
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
 * Pastes markdown text into the ProseMirror editor by dispatching a synthetic
 * paste event. Waits briefly for the async paste plugin to process.
 */
export const pasteMarkdown = async ({
  window,
  text,
}: {
  window: Page;
  text: string;
}): Promise<void> => {
  const editor = window.locator('.ProseMirror');
  await editor.focus();
  await window.evaluate((md: string) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', md);
    const event = new ClipboardEvent('paste', {
      clipboardData,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector('.ProseMirror')!.dispatchEvent(event);
  }, text);
  // The paste plugin is async (uses setTimeout(..., 0))
  await window.waitForTimeout(200);
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
 * a "Delete" action for directory nodes (bypassing the native OS menu popup
 * that Playwright cannot interact with).
 */
export const deleteFolderFromContextMenu = async ({
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
          action: { type: 'DELETE', path: payload.path },
        });
      }
    });
  });
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
 * Mocks the main-process context-menu:show handler to auto-respond with
 * a "Rename" action for file nodes (bypassing the native OS menu popup that
 * Playwright cannot interact with).
 */
export const renameFileFromContextMenu = async ({
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
          action: { type: 'RENAME', path: payload.path },
        });
      }
    });
  });
};

/**
 * Mocks the main-process context-menu:show handler to auto-respond with
 * a "Rename" action for directory nodes (bypassing the native OS menu popup that
 * Playwright cannot interact with).
 */
export const renameFolderFromContextMenu = async ({
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
          action: { type: 'RENAME', path: payload.path },
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
  await deleteBtn.waitFor({ state: 'visible', timeout: 2_000 });
  await deleteBtn.click();
  await deleteBtn.waitFor({ state: 'hidden', timeout: 2_000 });
};
