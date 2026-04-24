import type { ElectronApplication, JSHandle } from '@playwright/test';

export type DeviceCodeStub = {
  userCode: string;
  verificationUri: string;
};

export type GithubDeviceFlowMock = JSHandle<{
  openedLinks: string[];
  uninstall: () => void;
}>;

/**
 * Stubs main-process GitHub device-flow fetches and captures
 * `open-external-link` IPC sends. `access_token` stays in
 * `authorization_pending` so the dialog stays open without completing auth.
 */
export const installGithubDeviceFlowMock = async (
  electronApp: ElectronApplication,
  { userCode, verificationUri }: DeviceCodeStub
): Promise<GithubDeviceFlowMock> =>
  electronApp.evaluateHandle(
    async ({ ipcMain }, stub) => {
      // createWindow registers the real handler asynchronously after launch;
      // wait for it so removeAllListeners isn't a no-op (leaving the real
      // handler to shell out to a browser alongside our spy).
      const waitDeadline = Date.now() + 10_000;
      while (ipcMain.listenerCount('open-external-link') === 0) {
        if (Date.now() > waitDeadline) {
          throw new Error(
            'Timed out waiting for open-external-link handler to register'
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const originalListeners = ipcMain.listeners('open-external-link');
      const openedLinks: string[] = [];
      ipcMain.removeAllListeners('open-external-link');
      ipcMain.on('open-external-link', (_event, url: string) => {
        openedLinks.push(url);
      });

      const stubbedResponses: Record<string, unknown> = {
        'https://github.com/login/device/code': {
          device_code: 'fake-device-code',
          user_code: stub.userCode,
          verification_uri: stub.verificationUri,
          expires_in: 900,
          interval: 5,
        },
        'https://github.com/login/oauth/access_token': {
          error: 'authorization_pending',
        },
      };

      // Assumes the GitHub auth module uses the global `fetch`;
      // a switch to axios/undici etc would silently bypass these stubs.
      // TODO: Handle this in a better way.
      const realFetch = globalThis.fetch;
      globalThis.fetch = ((input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        const body = stubbedResponses[url];
        return body === undefined
          ? realFetch(input, init)
          : new Response(JSON.stringify(body), {
              headers: { 'Content-Type': 'application/json' },
            });
      }) as typeof fetch;

      const uninstall = () => {
        globalThis.fetch = realFetch;
        ipcMain.removeAllListeners('open-external-link');
        for (const listener of originalListeners) {
          ipcMain.on(
            'open-external-link',
            listener as (...args: unknown[]) => void
          );
        }
      };

      return { openedLinks, uninstall };
    },
    { userCode, verificationUri }
  );

export const getOpenedExternalLinks = async (
  mock: GithubDeviceFlowMock
): Promise<string[]> => mock.evaluate((state) => state.openedLinks);

export const uninstallGithubDeviceFlowMock = async (
  mock: GithubDeviceFlowMock
): Promise<void> => mock.evaluate((state) => state.uninstall());

/**
 * Reads the OS clipboard via main-process Electron APIs, bypassing Chromium
 * permission gates so the assertion reflects the renderer-side write alone.
 */
export const readMainClipboard = async (
  electronApp: ElectronApplication
): Promise<string> =>
  electronApp.evaluate(({ clipboard }) => clipboard.readText());
