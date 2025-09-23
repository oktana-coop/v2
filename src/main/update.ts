import { app, ipcMain } from 'electron';
import electronLogger from 'electron-log/main';
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo,
} from 'electron-updater';

autoUpdater.forceDevUpdateConfig = true;
autoUpdater.logger = electronLogger;

export const update = (win: Electron.BrowserWindow) => {
  if (process.platform === 'linux') {
    // Skip auto-update on Linux, handled via package manager instead
    return;
  }

  // When set to false, the update download will be triggered through the API
  autoUpdater.autoDownload = false;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.allowDowngrade = false;

  // start check
  autoUpdater.on('checking-for-update', function () {});
  // update available
  autoUpdater.on('update-available', (arg: UpdateInfo) => {
    win.webContents.send('update-can-available', {
      update: true,
      version: app.getVersion(),
      newVersion: arg?.version,
    });
  });
  // update not available
  autoUpdater.on('update-not-available', (arg: UpdateInfo) => {
    win.webContents.send('update-can-available', {
      update: false,
      version: app.getVersion(),
      newVersion: arg?.version,
    });
  });

  // Checking for updates
  ipcMain.handle('check-update', checkForUpdates);

  // Start downloading and feedback on progress
  ipcMain.handle('start-download', (event: Electron.IpcMainInvokeEvent) => {
    startDownload(
      (error, progressInfo) => {
        if (error) {
          // feedback download error message
          event.sender.send('update-error', { message: error.message, error });
        } else {
          // feedback update progress message
          event.sender.send('download-progress', progressInfo);
        }
      },
      () => {
        // feedback update downloaded message
        event.sender.send('update-downloaded');
      }
    );
  });

  // Install now
  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
};

const startDownload = (
  callback: (error: Error | null, info: ProgressInfo | null) => void,
  complete: (event: UpdateDownloadedEvent) => void
) => {
  autoUpdater.on('download-progress', (info: ProgressInfo) =>
    callback(null, info)
  );
  autoUpdater.on('error', (error: Error) => callback(error, null));
  autoUpdater.on('update-downloaded', complete);
  autoUpdater.downloadUpdate();
};

export const checkForUpdates = async () => {
  if (!app.isPackaged && !autoUpdater.forceDevUpdateConfig) {
    const error = new Error(
      'The update feature is only available after the package.'
    );
    return { message: error.message, error };
  }

  try {
    return await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    return { message: 'Network error', error };
  }
};
