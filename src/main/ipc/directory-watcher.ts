import { type BrowserWindow, ipcMain } from 'electron';

import { type DirectoryWatcher } from '../../modules/infrastructure/filesystem';

type StartWatchingArgs = {
  path: string;
  ignoredTopLevelEntries: string[];
};

export const registerDirectoryWatcherEvents = ({
  directoryWatcher,
  window,
}: {
  directoryWatcher: DirectoryWatcher;
  window: BrowserWindow;
}) => {
  ipcMain.on(
    'directory-watcher:start',
    (_, { path, ignoredTopLevelEntries }: StartWatchingArgs) => {
      directoryWatcher.watchDirectory({
        path,
        ignoredTopLevelEntries,
        onChange: () => {
          // A signal can still land between the window being destroyed and
          // teardown running.
          if (window.isDestroyed()) return;

          window.webContents.send('directory-watcher:changed', path);
        },
      });
    }
  );

  ipcMain.on('directory-watcher:stop', (_, path: string) => {
    directoryWatcher.unwatchDirectory(path);
  });
};
