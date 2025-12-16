import * as Effect from 'effect/Effect';
import { type BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';

import {
  type Email,
  githubAuthUsingDeviceFlow,
  parseEmail,
  parseUsername,
  type Username,
} from '../modules/auth/node';
import { type UserPreferences } from './store';

export const registerAuthInfoIPCHandlers = ({
  store,
  win,
}: {
  store: Store<UserPreferences>;
  win: BrowserWindow;
}) => {
  ipcMain.on('auth:set-username', (_, username: Username | null) => {
    store.set('auth.username', username);
  });

  ipcMain.on('auth:set-email', (_, email: Email | null) => {
    store.set('auth.email', email);
  });

  ipcMain.handle('auth:get-info', async () => {
    const storeUsername = store.get('auth.username') || null;
    const username = storeUsername ? parseUsername(storeUsername) : null;

    const storeEmail = store.get('auth.email') || null;
    const email = storeEmail ? parseEmail(storeEmail) : null;

    const storeGithubUserInfo = store.get('auth.githubUserInfo') || null;
    const githubUserInfo = storeGithubUserInfo ?? null;

    return {
      username,
      email,
      githubUserInfo,
    };
  });

  ipcMain.handle('auth:github-device-flow', async () => {
    const { userInfo } = await Effect.runPromise(
      githubAuthUsingDeviceFlow((verificationInfo) => {
        win.webContents.send(
          'auth:github-device-flow-verification-info',
          verificationInfo
        );
      })
    );

    // TODO: Store token securely

    store.set('auth.githubUserInfo', userInfo);

    return userInfo;
  });

  ipcMain.handle('auth:disconnect-from-github', async () => {
    // TODO: Delete token locally and ideally also call the GitHub API to revoke the token
    store.set('auth.githubUserInfo', null);
  });
};
