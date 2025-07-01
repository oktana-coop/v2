import {
  NetworkAdapter,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';

import { MAIN_PROCESS_PEER_ID } from './constants';
import {
  createInitiatorJoinMessage,
  createReceiverAckMessage,
  type IPCMessage,
  isInitiatorJoinMessage,
  isReceiverAckMessage,
} from './messages';

export class ElectronIPCRendererProcessAdapter extends NetworkAdapter {
  isInitiator: boolean;
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

  constructor(isInitiator: boolean = false) {
    super();
    this.isInitiator = isInitiator;
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
    console.log(
      `Renderer adapter with storage ID ${peerMetadata?.storageId} connecting`,
      new Date().toTimeString()
    );

    this.peerId = peerId;
    this.peerMetadata = peerMetadata;

    this.#unregisterListener =
      window.automergeRepoNetworkAdapter.onReceiveMainProcessMessage(
        (message: IPCMessage) => {
          this.receiveMessage(message);
        }
      );

    if (this.isInitiator) {
      this.send(
        createInitiatorJoinMessage(
          peerId,
          this.peerMetadata ?? {},
          MAIN_PROCESS_PEER_ID as PeerId
        )
      );
    }

    this.#disconnected = false;
  }

  disconnect() {
    console.log(
      `Renderer adapter with storage ID ${this.peerMetadata?.storageId} disconnecting`,
      new Date().toTimeString()
    );

    if (this.remotePeerId) {
      this.emit('peer-disconnected', { peerId: this.remotePeerId });
      this.emit('close');
    }

    this.#unregisterListener?.();
    this.#disconnected = true;
  }

  send(message: IPCMessage) {
    if (message.type !== 'sync') {
      console.log(
        `Renderer adapter (disconnected: ${this.#disconnected}) with storage ID ${this.peerMetadata?.storageId} sending message`,
        JSON.stringify(message),
        new Date().toTimeString()
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

  receiveMessage(message: IPCMessage) {
    if (message.type !== 'sync') {
      console.log(
        `Renderer adapter (disconnected: ${this.#disconnected}) with storage ID ${this.peerMetadata?.storageId} received message`,
        JSON.stringify(message),
        new Date().toTimeString()
      );
    }

    if (this.#disconnected) {
      return;
    }

    if (!this.isInitiator && isInitiatorJoinMessage(message)) {
      // main process repo is ready, acknowledge by sending a renderer ack message
      this.send(
        createReceiverAckMessage(
          this.peerId!,
          this.peerMetadata ?? {},
          message.senderId
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
    } else if (this.isInitiator && isReceiverAckMessage(message)) {
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
