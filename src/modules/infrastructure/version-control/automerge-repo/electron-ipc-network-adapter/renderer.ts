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
    this.peerId = peerId;
    this.peerMetadata = peerMetadata;

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
  }

  disconnect() {
    this.#ready = false;

    if (this.remotePeerId) {
      this.emit('peer-disconnected', { peerId: this.remotePeerId });
      this.emit('close');
    }
  }

  send(message: IPCMessage) {
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
