import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import { type BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';

import {
  disconnectFromGithub,
  type Email,
  type EncryptedStore,
  githubAuthUsingDeviceFlow,
  type GithubDeviceFlowResponse,
  parseEmail,
  parseUsername,
  RepositoryError,
  SyncProviderAuthError,
  type Username,
} from '../modules/auth/node';
import { type UserPreferences } from './store';

export const registerAuthInfoIPCHandlers = ({
  store,
  win,
  encryptedStore,
}: {
  store: Store<UserPreferences>;
  win: BrowserWindow;
  encryptedStore: EncryptedStore;
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

  // We are using the Effect fiber (computation handle) so that we can stop polling if the user cancels the auth flow.
  let githubDeviceFlowComputationHandle: Fiber.RuntimeFiber<
    GithubDeviceFlowResponse,
    SyncProviderAuthError | RepositoryError
  > | null = null;

  ipcMain.handle('auth:github-device-flow', async () => {
    // Cancel any existing auth flow
    if (githubDeviceFlowComputationHandle) {
      await Effect.runPromise(
        Fiber.interrupt(githubDeviceFlowComputationHandle)
      );
      githubDeviceFlowComputationHandle = null;
    }

    const deviceFlowEffect = githubAuthUsingDeviceFlow({ encryptedStore })((
      verificationInfo
    ) => {
      win.webContents.send(
        'auth:github-device-flow-verification-info',
        verificationInfo
      );
    });

    // Run as a fiber to get a reference to the device flow computation (so that's interruptible).
    githubDeviceFlowComputationHandle = Effect.runFork(deviceFlowEffect);

    try {
      const { userInfo } = await Effect.runPromise(
        Fiber.join(githubDeviceFlowComputationHandle)
      );

      store.set('auth.githubUserInfo', userInfo);
      githubDeviceFlowComputationHandle = null;

      return userInfo;
    } catch (error) {
      // TODO: Potentially map Fiber failures related to interruptions with a successful resolution (or a special error).
      githubDeviceFlowComputationHandle = null;
      throw error;
    }
  });

  ipcMain.handle('auth:cancel-github-device-flow', async () => {
    if (githubDeviceFlowComputationHandle) {
      await Effect.runPromise(
        Fiber.interrupt(githubDeviceFlowComputationHandle)
      );
      githubDeviceFlowComputationHandle = null;
    }
  });

  ipcMain.handle('auth:disconnect-from-github', async () => {
    await Effect.runPromise(disconnectFromGithub({ encryptedStore })());
    store.set('auth.githubUserInfo', null);
  });
};
