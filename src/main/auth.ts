import { ipcMain } from 'electron';
import Store from 'electron-store';

import {
  type Email,
  parseEmail,
  parseUsername,
  type Username,
} from '../modules/auth/node';
import { type UserPreferences } from './store';

export const registerAuthInfoIPCHandlers = ({
  store,
}: {
  store: Store<UserPreferences>;
}) => {
  ipcMain.on('auth:set-username', (_, username: Username | null) => {
    store.set('auth.username', username);
  });

  ipcMain.on('auth:set-email', (_, email: Email | null) => {
    store.set('auth.email', email);
  });

  ipcMain.handle('auth:get-info', () => {
    const storeUsername = store.get('auth.username') || null;
    const username = storeUsername ? parseUsername(storeUsername) : null;

    const storeEmail = store.get('auth.email') || null;
    const email = storeEmail ? parseEmail(storeEmail) : null;

    return {
      username,
      email,
    };
  });
};
