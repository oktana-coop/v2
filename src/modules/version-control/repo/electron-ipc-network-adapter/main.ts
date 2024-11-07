import {
  NetworkAdapter,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';
import { BrowserWindow, ipcMain } from 'electron';

import {
  FromMainMessage,
  FromRendererMessage,
  isJoinMessage,
} from './messages';

export class ElectronIPCMainProcessAdapter extends NetworkAdapter {
  renderers: Map<PeerId, BrowserWindow>;

  #ready = false;
  #readyResolver?: () => void;
  #readyPromise: Promise<void> = new Promise<void>((resolve) => {
    this.#readyResolver = resolve;
  });

  isReady() {
    return this.#ready;
  }

  whenReady() {
    return this.#readyPromise;
  }

  #forceReady() {
    if (!this.#ready) {
      this.#ready = true;
      this.#readyResolver?.();
    }
  }

  constructor(renderers: Map<string, BrowserWindow>) {
    if (renderers.size === 0) {
      throw new Error(
        'At least one renderer is needed to setup the Automerge Electron IPC network main process adapter'
      );
    }

    super();

    this.renderers = renderers as Map<PeerId, BrowserWindow>;
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
    this.peerId = peerId;
    this.peerMetadata = peerMetadata;

    ipcMain.on('automerge-repo-renderer-process-message', (_, message) => {
      this.receiveMessage(message);
    });

    this.#forceReady();
  }

  disconnect(): void {
    this.peerId = undefined;
    this.peerMetadata = undefined;
    this.renderers.clear();
    this.#ready = false;
  }

  send(message: FromMainMessage): void {
    if ('data' in message && message.data?.byteLength === 0)
      throw new Error('Tried to send a zero-length message');

    const senderId = this.peerId;

    if (!senderId) {
      throw new Error(
        'No peerId set for the Electron main process network adapter.'
      );
    }

    const renderer = this.renderers.get(message.targetId);

    if (!renderer) {
      return;
    }

    renderer.webContents.send('automerge-repo-main-process-message', message);
  }

  receiveMessage(message: FromRendererMessage) {
    if (!this.peerId) {
      throw new Error(
        'No peerId set for the Electron main process network adapter.'
      );
    }

    if (isJoinMessage(message)) {
      const { peerMetadata } = message;

      // Let the repo know that we have a new connection.
      this.emit('peer-candidate', { peerId: message.senderId, peerMetadata });

      this.send({
        type: 'peer',
        senderId: this.peerId!,
        peerMetadata: this.peerMetadata!,
        targetId: message.senderId,
      });
    } else {
      this.emit('message', message);
    }
  }
}
