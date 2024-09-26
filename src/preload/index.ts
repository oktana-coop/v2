import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setupVersionControlRepo: () =>
    ipcRenderer.invoke('setup-version-control-repo'),
});
