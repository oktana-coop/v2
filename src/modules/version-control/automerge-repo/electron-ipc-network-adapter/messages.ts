import {
  type Message,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';

/** Sent by the main to the renderer process to tell the renderer that the main repo has been setup (and its peer ID) */
export type MainJoinMessage = {
  type: 'main-join';
  /** The PeerID of main */
  senderId: PeerId;
  /** Metadata presented by the peer  */
  peerMetadata: PeerMetadata;
  /** The PeerID of main */
  targetId: PeerId;
};

/** Sent by the renderer in response to a "join" message to advertise its PeerID (in case we have many renderers) */
export type RendererAckMessage = {
  type: 'renderer-ack';
  /** The PeerID of the renderer */
  senderId: PeerId;
  /** Metadata presented by the peer  */
  peerMetadata: PeerMetadata;
  /** The PeerID of main */
  targetId: PeerId;
};

/** A message from the main to the renderer process */
export type FromMainMessage = MainJoinMessage | Message;

/** A message from the renderer to the main process */
export type FromRendererMessage = RendererAckMessage | Message;

export const isMainJoinMessage = (
  message: FromMainMessage
): message is MainJoinMessage => message.type === 'main-join';

export const isRendererAck = (
  message: FromRendererMessage
): message is RendererAckMessage => message.type === 'renderer-ack';
