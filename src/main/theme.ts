import { BrowserWindow, ipcMain, nativeTheme } from 'electron';
import Store from 'electron-store';

import { type Theme, themes } from '../modules/personalization';
import { type UserPreferences } from './store';

export const setSavedOrDefaultTheme = (store: Store<UserPreferences>) => {
  const savedTheme = store.get('theme', themes.system); // default to system
  nativeTheme.themeSource = savedTheme;
};

export const registerThemeIPCHandlers = ({
  store,
  win,
}: {
  store: Store<UserPreferences>;
  win: BrowserWindow;
}) => {
  ipcMain.on('set-theme', (_, theme: Theme) => {
    store.set('theme', theme);
    nativeTheme.themeSource = theme;
  });

  ipcMain.handle('get-theme', () => store.get('theme'));

  ipcMain.handle('get-system-theme', () =>
    nativeTheme.shouldUseDarkColors ? themes.dark : themes.light
  );

  nativeTheme.on('updated', () => {
    win.webContents.send(
      'system-theme-update',
      nativeTheme.shouldUseDarkColors ? themes.dark : themes.light
    );
  });
};
