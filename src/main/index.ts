import { release } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exec } from 'child_process';
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  session,
  shell,
} from 'electron';
import os from 'os';

import { PROJECT_FILE_EXTENSION } from '../modules/domain/project';
import { runPromiseSerializingErrorsForIPC } from '../modules/infrastructure/cross-platform';
import {
  type CreateNewFileArgs,
  type File,
  filesystemItemTypes,
  GetAbsolutePathArgs,
  GetRelativePathArgs,
  type ListDirectoryFilesArgs,
  type OpenFileArgs,
  WriteFileArgs,
} from '../modules/infrastructure/filesystem';
import { createAdapter as createElectronNodeFilesystemAPIAdapter } from '../modules/infrastructure/filesystem/adapters/electron-node-api';
import { type RunWasiCLIArgs } from '../modules/infrastructure/wasm';
import { createAdapter as createNodeWasmAdapter } from '../modules/infrastructure/wasm/adapters/node-wasm';
import { registerAuthInfoIPCHandlers } from './auth';
import { registerVersionedStoresEvents } from './ipc';
import { buildMenu } from './menu';
import { initializeStore } from './store';
import { registerThemeIPCHandlers, setSavedOrDefaultTheme } from './theme';
import { update } from './update';

const store = initializeStore();
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
let fileWaitingToBeOpened: File | null = null;

const openFileFromOs = ({
  window,
  file,
}: {
  window: BrowserWindow;
  file: File;
}) => {
  window.webContents.send('open-file-from-os', file);
};

const openFileOrQueue = (file: File) => {
  if (win && win.webContents && !win.webContents.isDestroyed()) {
    openFileFromOs({ window: win, file });
  } else {
    fileWaitingToBeOpened = file;
  }
};

const getFileFromPath = (filePath: string): File => {
  const name = basename(filePath);

  const file: File = {
    type: filesystemItemTypes.FILE,
    name,
    path: filePath,
  };

  return file;
};

// macOS: when user double-clicks a file
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  const file = getFileFromPath(filePath);
  openFileOrQueue(file);
});

const openFileFromOsArgs = ({
  window,
  argv,
}: {
  window: BrowserWindow;
  argv: string[];
}) => {
  const filePath = argv[argv.length - 1];
  if (filePath && filePath.endsWith(`.${PROJECT_FILE_EXTENSION}`)) {
    const file = getFileFromPath(filePath);
    openFileFromOs({ window, file });
  }
};

// Windows/Linux: check process.argv for a file path when app starts
if (process.platform !== 'darwin' && process.argv.length > 1) {
  const filePath = process.argv[1];
  if (filePath && filePath.endsWith(`.${PROJECT_FILE_EXTENSION}`)) {
    const file = getFileFromPath(filePath);
    openFileOrQueue(file);
  }
}

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
    app.dock?.setIcon(macOSDockIcon);
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

  registerVersionedStoresEvents({
    filesystem: filesystemAPI,
    rendererProcessId,
    browserWindow: win,
  });

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('renderer-process-id', rendererProcessId);

    // If there was a file waiting to be opened, open it now
    if (fileWaitingToBeOpened && win) {
      openFileFromOs({ window: win, file: fileWaitingToBeOpened });
      fileWaitingToBeOpened = null;
    }
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
  ipcMain.handle(
    'list-directory-files',
    async (_, args: ListDirectoryFilesArgs) =>
      runPromiseSerializingErrorsForIPC(filesystemAPI.listDirectoryFiles(args))
  );
  ipcMain.handle('request-permission-for-directory', (_, path: string) =>
    runPromiseSerializingErrorsForIPC(
      filesystemAPI.requestPermissionForDirectory(path)
    )
  );
  ipcMain.handle('assert-write-permission-for-directory', (_, path: string) =>
    runPromiseSerializingErrorsForIPC(
      filesystemAPI.assertWritePermissionForDirectory(path)
    )
  );
  ipcMain.handle('create-new-file', (_, args: CreateNewFileArgs) =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.createNewFile(args))
  );
  ipcMain.handle('open-file', async (_, args: OpenFileArgs) =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.openFile(args))
  );
  ipcMain.handle('write-file', (_, args: WriteFileArgs) =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.writeFile(args))
  );
  ipcMain.handle('read-text-file', (_, path: string) =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.readTextFile(path))
  );
  ipcMain.handle('get-relative-path', (_, args: GetRelativePathArgs) =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.getRelativePath(args))
  );
  ipcMain.handle('get-absolute-path', (_, args: GetAbsolutePathArgs) =>
    runPromiseSerializingErrorsForIPC(filesystemAPI.getAbsolutePath(args))
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

  ipcMain.handle('run-wasi-cli-outputing-text', (_, args: RunWasiCLIArgs) =>
    wasmAPI.runWasiCLIOutputingText(args)
  );

  ipcMain.handle('run-wasi-cli-outputing-binary', (_, args: RunWasiCLIArgs) =>
    wasmAPI.runWasiCLIOutputingBinary(args)
  );

  registerAuthInfoIPCHandlers({ store, win });
  registerThemeIPCHandlers({ store, win });
}

app.whenReady().then(() => {
  const menu = buildMenu();
  Menu.setApplicationMenu(menu);

  setSavedOrDefaultTheme(store);

  createWindow();
});

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

app.on('second-instance', (_, argv) => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();

    // Handle opening a file from the OS when the app is open in Windows and Linux
    if (process.platform !== 'darwin' && argv.length > 1) {
      openFileFromOsArgs({ window: win, argv });
    }
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

ipcMain.handle('clear-web-storage', async (event) => {
  const ses = event.sender.session;
  await ses.clearStorageData();
});
