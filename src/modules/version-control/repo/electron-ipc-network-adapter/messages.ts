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

/** A message from the renderer to the main process */
export type FromRendererMessage = JoinMessage | Message;

export const isJoinMessage = (
  message: FromRendererMessage
): message is JoinMessage => message.type === 'join';
