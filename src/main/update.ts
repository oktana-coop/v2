import { app, ipcMain } from 'electron';
import electronLogger from 'electron-log/main';
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo,
} from 'electron-updater';

import {
  type CheckingForUpdateState,
  DownloadingUpdateState,
  type UpdateAvailableState,
  type UpdateNotAvailableState,
} from '../modules/infrastructure/cross-platform/update';

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
  autoUpdater.on('checking-for-update', function () {
    const updateState: CheckingForUpdateState = {
      status: 'checking-for-update',
    };

    win.webContents.send('checking-for-update', updateState);
  });

  // update available
  autoUpdater.on('update-available', (arg: UpdateInfo) => {
    const updateState: UpdateAvailableState = {
      status: 'update-available',
      version: app.getVersion(),
      newVersion: arg.version,
    };

    win.webContents.send('update-available', updateState);
  });

  // update not available
  autoUpdater.on('update-not-available', () => {
    const updateState: UpdateNotAvailableState = {
      status: 'update-not-available',
      version: app.getVersion(),
    };

    win.webContents.send('update-not-available', updateState);
  });

  // Checking for updates
  ipcMain.handle('check-update', checkForUpdates);

  // Start downloading and feedback on progress
  ipcMain.handle('download-update', (event: Electron.IpcMainInvokeEvent) => {
    console.log('Start downloading update...');
    startDownload(
      (error, progressInfo) => {
        if (error) {
          // feedback download error message
          event.sender.send('update-error', { message: error.message, error });
        } else {
          const updateState: DownloadingUpdateState = {
            status: 'downloading-update',
            progress: progressInfo ? progressInfo.percent / 100 : 0,
          };

          // feedback update progress message
          event.sender.send('downloading-update', updateState);
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
