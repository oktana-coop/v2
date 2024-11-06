import {
  type Message,
  NetworkAdapter,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';

import { FromRendererMessage, JoinMessage } from './messages';

export class ElectronIPCRendererProcessAdapter extends NetworkAdapter {
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

  remotePeerId?: PeerId; // this adapter only connects to one remote client at a time

  constructor() {
    super();
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
    this.peerId = peerId;
    this.peerMetadata = peerMetadata;
    this.send(joinMessage(this.peerId, this.peerMetadata ?? {}));
    // TODO: Do we need acknowledgement?
    this.#forceReady();
  }

  disconnect() {
    if (this.remotePeerId)
      this.emit('peer-disconnected', { peerId: this.remotePeerId });
  }

  send(message: FromRendererMessage) {
    if ('data' in message && message.data?.byteLength === 0)
      throw new Error('Tried to send a zero-length message');

    if (!this.peerId) {
      throw new Error(
        'No peerId set for the Electron renderer process network adapter.'
      );
    }

    window.automergeRepoNetworkAdapter.sendRendererMessage(message);
  }
}

function joinMessage(
  senderId: PeerId,
  peerMetadata: PeerMetadata
): JoinMessage {
  return {
    type: 'join',
    senderId,
    peerMetadata,
  };
}
