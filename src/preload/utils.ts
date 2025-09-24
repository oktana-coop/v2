import { ipcRenderer } from 'electron';

export function registerIpcListener<T>(
  channel: string,
  callback: (data: T) => void
): () => void {
  const listener = (_: Electron.IpcRendererEvent, data: T) => {
    callback(data);
  };

  ipcRenderer.on(channel, listener);

  // Return a cleanup/unsubscribe function
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}
