import { contextBridge, ipcRenderer } from 'electron';

import { FromRendererMessage } from '../modules/version-control';

contextBridge.exposeInMainWorld('automergeRepoNetworkAdapter', {
  sendRendererMessage: (message: FromRendererMessage) =>
    ipcRenderer.send('automerge-repo-renderer-message', message),
});
