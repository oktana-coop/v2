import {
  type Message,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';

/** Sent by the renderer to the main process to tell the main the renderer's PeerID */
export type JoinMessage = {
  type: 'join';
  /** The PeerID of the renderer */
  senderId: PeerId;
  /** Metadata presented by the peer  */
  peerMetadata: PeerMetadata;
};

/** Sent by the main in response to a "join" message to advertise the main process' PeerID */
export type PeerMessage = {
  type: 'peer';
  /** The PeerID of the server */
  senderId: PeerId;
  /** Metadata presented by the peer  */
  peerMetadata: PeerMetadata;
  /** The PeerID of the client */
  targetId: PeerId;
};

/** A message from the main to the renderer process */
export type FromMainMessage = PeerMessage | Message;

/** A message from the renderer to the main process */
export type FromRendererMessage = JoinMessage | Message;

export const isJoinMessage = (
  message: FromRendererMessage
): message is JoinMessage => message.type === 'join';

export const isPeerMessage = (
  message: FromMainMessage
): message is PeerMessage => message.type === 'peer';
