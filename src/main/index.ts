import { release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exec } from 'child_process';
import * as Effect from 'effect/Effect';
import {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  session,
  shell,
} from 'electron';
import os from 'os';

import { runPromiseSerializingErrorsForIPC } from '../modules/electron/ipc-effect';
import { createAdapter as createElectronNodeFilesystemAPIAdapter } from '../modules/filesystem/adapters/electron-node-api';
import { type VersionControlId } from '../modules/version-control';
import {
  openOrCreateProject,
  openProjectById,
} from '../modules/version-control/automerge-repo/node';
import { RunWasiCLIArgs } from '../modules/wasm';
import { createAdapter as createNodeWasmAdapter } from '../modules/wasm/adapters/node-wasm';
import { update } from './update';

const filesystemAPI = createElectronNodeFilesystemAPIAdapter();

globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = dirname(__filename);

// The built directory structure
//
// ├─┬ dist
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js   > Preload-Scripts
// │ └─┬ renderer
// │   └── index.mjs
process.env.DIST_ELECTRON = join(__dirname, '../');
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist');
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null;
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js');
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, 'renderer/index.html');

async function createWindow() {
  const icon = nativeImage.createFromPath(
    join(process.env.VITE_PUBLIC as string, 'icon.png')
  );

  if (os.platform() === 'darwin') {
    const macOSDockIcon = nativeImage.createFromPath(
      join(process.env.VITE_PUBLIC as string, 'macos-dock-icon.png')
    );
    app.dock.setIcon(macOSDockIcon);
  }

  const wasmAPI = await createNodeWasmAdapter();

  win = new BrowserWindow({
    title: 'Main window',
    icon,
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });

  if (url) {
    // electron-vite-vue#298
    win.loadURL(url);
    // Disabling this as it causes this error:
    // https://github.com/electron/electron/issues/41614#issuecomment-2003121248
    // win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  const rendererProcessId = String(win.webContents.id);

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('renderer-process-id', rendererProcessId);
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Apply electron-updater
  update(win);

  ipcMain.handle('open-directory', async () =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.openDirectory())
  );
  ipcMain.handle('get-directory', async (_, path: string) =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.getDirectory(path))
  );
  ipcMain.handle('list-directory-files', async (_, path: string) =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.listDirectoryFiles(path))
  );
  ipcMain.handle('request-permission-for-directory', (_, path: string) =>
    runPromiseSerializingErrorsForIPC(
      filesystemAPI.requestPermissionForDirectory(path)
    )
  );
  ipcMain.handle('create-new-file', (_, suggestedName: string) =>
    runPromiseSerializingErrorsForIPC(
      filesystemAPI.createNewFile(suggestedName)
    )
  );
  ipcMain.handle(
    'write-file',
    (_, { path, content }: { path: string; content: string }) =>
      runPromiseSerializingErrorsForIPC(filesystemAPI.writeFile(path, content))
  );
  ipcMain.handle('read-file', (_, path: string) =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.readFile(path))
  );

  ipcMain.handle(
    'open-or-create-project',
    async (_, { directoryPath }: { directoryPath: string }) => {
      if (!win) {
        throw new Error(
          'No browser window found when trying to create project'
        );
      }

      return Effect.runPromise(
        openOrCreateProject({
          directoryPath,
          rendererProcessId,
          browserWindow: win,
          listDirectoryFiles: filesystemAPI.listDirectoryFiles,
          readFile: filesystemAPI.readFile,
          writeFile: filesystemAPI.writeFile,
          assertWritePermissionForDirectory:
            filesystemAPI.assertWritePermissionForDirectory,
        })
      );
    }
  );

  ipcMain.handle(
    'open-project',
    async (
      _,
      {
        directoryPath,
        projectId,
      }: { projectId: VersionControlId; directoryPath: string }
    ) => {
      if (!win) {
        throw new Error(
          'No browser window found when trying to create project'
        );
      }

      return Effect.runPromise(
        openProjectById({
          projectId,
          directoryPath,
          rendererProcessId,
          browserWindow: win,
          listDirectoryFiles: filesystemAPI.listDirectoryFiles,
          readFile: filesystemAPI.readFile,
          assertWritePermissionForDirectory:
            filesystemAPI.assertWritePermissionForDirectory,
        })
      );
    }
  );

  ipcMain.on('open-external-link', (_, url: string) => {
    if (os.platform() === 'darwin') {
      // Use the `open` command to launch the default browser
      exec(`open "${url}"`, (error) => {
        if (error) {
          console.error("Failed to open link with 'open' command:", error);
          // Fallback to Electron's default method
          shell.openExternal(url);
        }
      });
    } else {
      // For non-macOS platforms, use Electron's default method
      shell.openExternal(url);
    }
  });

  ipcMain.handle('run-wasi-cli', (_, args: RunWasiCLIArgs) =>
    wasmAPI.runWasiCLI(args)
  );
}

app.whenReady().then(createWindow);

app.on('before-quit', async () => {
  const defaultSession = session.defaultSession;
  await defaultSession.clearStorageData({
    storages: ['indexdb'],
  });
});

app.on('window-all-closed', () => {
  win = null;
  if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});
