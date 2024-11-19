import {
  NetworkAdapter,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';

import {
  FromMainMessage,
  FromRendererMessage,
  isMainJoinMessage,
  RendererAckMessage,
} from './messages';

const createRendererAckMessage = (
  senderId: PeerId,
  peerMetadata: PeerMetadata,
  targetId: PeerId
): RendererAckMessage => {
  return {
    type: 'renderer-ack',
    senderId,
    peerMetadata,
    targetId,
  };
};

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

  receiveMessage(message: FromMainMessage) {
    if (isMainJoinMessage(message)) {
      // main process repo is ready, acknowledge by sending a renderer ack message
      this.send(
        createRendererAckMessage(
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
    } else {
      this.emit('message', message);
    }
  }
}
