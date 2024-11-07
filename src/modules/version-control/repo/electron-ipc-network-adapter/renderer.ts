import {
  NetworkAdapter,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';

import {
  FromMainMessage,
  FromRendererMessage,
  isPeerMessage,
  JoinMessage,
} from './messages';

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

  // this adapter only connects to one remote client at a time (the main process)
  remotePeerId?: PeerId;

  constructor() {
    super();
  }

  connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
    this.peerId = peerId;
    this.peerMetadata = peerMetadata;

    window.automergeRepoNetworkAdapter.onReceiveMainProcessMessage(
      (message: FromMainMessage) => {
        this.receiveMessage(message);
      }
    );

    this.send(joinMessage(this.peerId, this.peerMetadata ?? {}));
  }

  disconnect() {}

  send(message: FromRendererMessage) {
    if ('data' in message && message.data?.byteLength === 0)
      throw new Error('Tried to send a zero-length message');

    if (!this.peerId) {
      throw new Error(
        'No peerId set for the Electron renderer process network adapter.'
      );
    }

    window.automergeRepoNetworkAdapter.sendRendererProcessMessage(message);
  }

  // Set the remote peer ID (which is the main process's peer ID), signify that we are ready and emit a peer-candidate event
  peerCandidate(remotePeerId: PeerId, peerMetadata: PeerMetadata) {
    this.#forceReady();
    this.remotePeerId = remotePeerId;
    this.emit('peer-candidate', {
      peerId: remotePeerId,
      peerMetadata,
    });
  }

  receiveMessage(message: FromMainMessage) {
    if (isPeerMessage(message)) {
      this.peerCandidate(message.senderId, message.peerMetadata);
    } else {
      this.emit('message', message);
    }
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
