import {
  NetworkAdapter,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';
import { BrowserWindow, ipcMain } from 'electron';

import {
  createInitiatorJoinMessage,
  createReceiverAckMessage,
  type FromMainMessage,
  type FromRendererMessage,
  type InitiatorJoinMessage,
  isInitiatorJoinMessage,
  isRendererInitiatorJoinMessage,
  isRendererReceiverAckMessage,
} from './messages';
import { ProcessId } from './types';

export class ElectronIPCMainProcessAdapter extends NetworkAdapter {
  isInitiator: boolean;
  #renderers: Map<ProcessId, BrowserWindow>;
  #renderersByPeerId: Map<PeerId, BrowserWindow>;

  #ready = false;
  #readyResolver?: () => void;
  #readyPromise: Promise<void> = new Promise<void>((resolve) => {
    this.#readyResolver = resolve;
  });
  #ipcListener?: (
    event: Electron.IpcMainEvent,
    message: FromRendererMessage
  ) => void;
  #disconnected = false;

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

  constructor(
    renderers: Map<string, BrowserWindow>,
    isInitiator: boolean = true
  ) {
    if (renderers.size === 0) {
      throw new Error(
        'At least one renderer is needed to setup the Automerge Electron IPC network main process adapter'
      );
    }

    super();

    this.isInitiator = isInitiator;
    this.#renderers = renderers;
    this.#renderersByPeerId = new Map();
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
    console.log(
      `Main adapter with peer ID ${peerId} connecting`,
      new Date().toLocaleTimeString(undefined, { hour12: false }) +
        '.' +
        String(new Date().getMilliseconds()).padStart(3, '0')
    );

    this.peerId = peerId;
    this.peerMetadata = peerMetadata;

    this.#ipcListener = (_, message) => this.receiveMessage(message);

    ipcMain.on('automerge-repo-renderer-process-message', this.#ipcListener);

    if (this.isInitiator) {
      this.send(createInitiatorJoinMessage(peerId, this.peerMetadata ?? {}));
    }

    this.#disconnected = false;
  }

  disconnect(): void {
    console.log(
      `Main adapter with peer ID ${this.peerId} disconnecting`,
      new Date().toLocaleTimeString(undefined, { hour12: false }) +
        '.' +
        String(new Date().getMilliseconds()).padStart(3, '0')
    );

    [...this.#renderersByPeerId.keys()].forEach((peerId) => {
      this.emit('peer-disconnected', { peerId });
    });

    this.emit('close');

    if (this.#ipcListener) {
      ipcMain.removeListener(
        'automerge-repo-renderer-process-message',
        this.#ipcListener
      );
    }

    this.#disconnected = true;
  }

  #broadcastToRenderers(message: InitiatorJoinMessage): void {
    [...this.#renderers.values()].forEach((renderer) => {
      renderer.webContents.send('automerge-repo-main-process-message', message);
    });
  }

  send(message: FromMainMessage): void {
    if (message.type !== 'sync') {
      console.log(
        `Main adapter with peer ID ${this.peerId} (disconnected: ${this.#disconnected}) sending message`,
        JSON.stringify(message),
        new Date().toLocaleTimeString(undefined, { hour12: false }) +
          '.' +
          String(new Date().getMilliseconds()).padStart(3, '0')
      );
    }

    if (this.#disconnected) {
      return;
    }

    if ('data' in message && message.data?.byteLength === 0)
      throw new Error('Tried to send a zero-length message');

    const senderId = this.peerId;

    if (!senderId) {
      throw new Error(
        'No peerId set for the Electron main process network adapter.'
      );
    }

    if (isInitiatorJoinMessage(message)) {
      this.#broadcastToRenderers(message);
    } else {
      const renderer = this.#renderersByPeerId.get(message.targetId);

      if (!renderer) {
        return;
      }

      renderer.webContents.send('automerge-repo-main-process-message', message);
    }
  }

  receiveMessage(message: FromRendererMessage) {
    if (message.type !== 'sync') {
      console.log(
        `Main adapter with peer ID ${this.peerId} (disconnected: ${this.#disconnected}) received message`,
        JSON.stringify(message),
        new Date().toLocaleTimeString(undefined, { hour12: false }) +
          '.' +
          String(new Date().getMilliseconds()).padStart(3, '0')
      );
      if (this.#disconnected) {
        return;
      }
    }

    if (!this.peerId) {
      throw new Error(
        'No peerId set for the Electron main process network adapter.'
      );
    }

    if (isRendererInitiatorJoinMessage(message)) {
      if (this.isInitiator) {
        throw new Error('Received unexpected initiator message from peer');
      }

      const rendererBrowserWindow = this.#renderers.get(message.processId);

      if (!rendererBrowserWindow) {
        throw new Error('Received IPC message from unknown renderer process');
      }

      this.#renderersByPeerId.set(message.senderId, rendererBrowserWindow);

      this.send(
        createReceiverAckMessage(
          this.peerId!,
          this.peerMetadata ?? {},
          message.senderId
        )
      );

      // Let the repo know that we have a new connection.
      this.emit('peer-candidate', {
        peerId: message.senderId,
        peerMetadata: this.peerMetadata ?? {},
      });

      this.#forceReady();
    } else {
      if (message.targetId !== this.peerId) {
        return;
      }

      if (isRendererReceiverAckMessage(message)) {
        if (!this.isInitiator) {
          throw new Error('Received unexpected receiver ack message from peer');
        }

        const rendererBrowserWindow = this.#renderers.get(message.processId);

        if (!rendererBrowserWindow) {
          throw new Error('Received IPC message from unknown renderer process');
        }

        this.#renderersByPeerId.set(message.senderId, rendererBrowserWindow);

        const { peerMetadata } = message;

        // Let the repo know that we have a new connection.
        this.emit('peer-candidate', { peerId: message.senderId, peerMetadata });
        this.#forceReady();
      } else {
        this.emit('message', message);
      }
    }
  }
}
