import { BrowserWindow } from 'electron';

export const sendIPCMessageToFocusedWindow = (
  message: string,
  data?: unknown
) => {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) {
    focused.webContents.send(message, data);
  }
};
