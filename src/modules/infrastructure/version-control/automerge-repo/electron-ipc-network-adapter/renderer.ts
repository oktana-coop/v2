import {
  NetworkAdapter,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';

import {
  createRendererInitiatorJoinMessage,
  createRendererReceiverAckMessage,
  type FromMainMessage,
  type FromRendererMessage,
  isInitiatorJoinMessage,
  isReceiverAckMessage,
} from './messages';
import { type ProcessId } from './types';

export class ElectronIPCRendererProcessAdapter extends NetworkAdapter {
  isInitiator: boolean;
  #processId: ProcessId;
  #ready = false;
  #readyResolver?: () => void;
  #readyPromise: Promise<void> = new Promise<void>((resolve) => {
    this.#readyResolver = resolve;
  });
  #disconnected = false;

  #unregisterListener?: () => void;

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

  // this adapter only connects to one remote client at a time (the main process)
  remotePeerId?: PeerId;

  constructor(processId: string, isInitiator: boolean = false) {
    super();
    this.#processId = processId;
    this.isInitiator = isInitiator;
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
    console.log(
      `Renderer adapter with peer ID ${peerId} connecting`,
      new Date().toLocaleTimeString(undefined, { hour12: false }) +
        '.' +
        String(new Date().getMilliseconds()).padStart(3, '0')
    );

    this.peerId = peerId;
    this.peerMetadata = peerMetadata;

    this.#unregisterListener =
      window.automergeRepoNetworkAdapter.onReceiveMainProcessMessage(
        (message: FromMainMessage) => {
          this.receiveMessage(message);
        }
      );

    if (this.isInitiator) {
      this.send(
        createRendererInitiatorJoinMessage(
          peerId,
          this.peerMetadata ?? {},
          this.#processId
        )
      );
    }

    this.#disconnected = false;
  }

  disconnect() {
    console.log(
      `Renderer adapter with peer ID ${this.peerId} disconnecting`,
      new Date().toLocaleTimeString(undefined, { hour12: false }) +
        '.' +
        String(new Date().getMilliseconds()).padStart(3, '0')
    );

    if (this.remotePeerId) {
      this.emit('peer-disconnected', { peerId: this.remotePeerId });
      this.emit('close');
    }

    this.#unregisterListener?.();
    this.#disconnected = true;
  }

  send(message: FromRendererMessage) {
    if (message.type !== 'sync') {
      console.log(
        `Renderer adapter (disconnected: ${this.#disconnected}) with peer ID ${this.peerId} sending message`,
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

    if (!this.peerId) {
      throw new Error(
        'No peerId set for the Electron renderer process network adapter.'
      );
    }

    window.automergeRepoNetworkAdapter.sendRendererProcessMessage(message);
  }

  receiveMessage(message: FromMainMessage) {
    if (message.type !== 'sync') {
      console.log(
        `Renderer adapter with peer ID ${this.peerId} (disconnected: ${this.#disconnected}) received message`,
        JSON.stringify(message),
        new Date().toLocaleTimeString(undefined, { hour12: false }) +
          '.' +
          String(new Date().getMilliseconds()).padStart(3, '0')
      );
    }

    if (this.#disconnected) {
      return;
    }

    if (isInitiatorJoinMessage(message)) {
      if (this.isInitiator) {
        throw new Error('Received unexpected initiator message from peer');
      }

      // main process repo is ready, acknowledge by sending a renderer ack message
      this.send(
        createRendererReceiverAckMessage(
          this.peerId!,
          this.peerMetadata ?? {},
          message.senderId,
          this.#processId
        )
      );

      // Set the remote peer ID (which is the main process's peer ID)
      this.remotePeerId = message.senderId;

      // Let the repo know that we have a new connection.
      this.emit('peer-candidate', {
        peerId: message.senderId,
        peerMetadata: this.peerMetadata ?? {},
      });

      this.#forceReady();
    } else {
      if (isReceiverAckMessage(message)) {
        if (!this.isInitiator) {
          throw new Error('Received unexpected receiver ack message from peer');
        }

        const { peerMetadata } = message;

        // Let the repo know that we have a new connection.
        this.emit('peer-candidate', { peerId: message.senderId, peerMetadata });
        this.remotePeerId = message.senderId;
        this.#forceReady();
      } else {
        this.emit('message', message);
      }
    }
  }
}
