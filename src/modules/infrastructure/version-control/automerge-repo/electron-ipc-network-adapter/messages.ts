import {
  type Message,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';

/** Sent by the initiator to the receiver process to tell the receiver that the initiator's repo has been setup (and its peer ID) */
export type InitiatorJoinMessage = {
  type: 'initiator-join';
  /** The PeerID of the initiator */
  senderId: PeerId;
  /** Metadata presented by the peer  */
  peerMetadata: PeerMetadata;
  /** The PeerID of the receiver */
  targetId: PeerId;
};

/** Sent by the receiver in response to a "join" message to advertise its PeerID (in case we have many receivers) */
export type ReceiverAckMessage = {
  type: 'receiver-ack';
  /** The PeerID of the sender */
  senderId: PeerId;
  /** Metadata presented by the peer  */
  peerMetadata: PeerMetadata;
  /** The PeerID of the target */
  targetId: PeerId;
};

export type IPCMessage = InitiatorJoinMessage | ReceiverAckMessage | Message;

/** A message from the initiator to the receiver process */
export type InitiatorMessage = InitiatorJoinMessage | Message;

/** A message from the receiver to the initiator process */
export type ReceiverMessage = ReceiverAckMessage | Message;

export const isInitiatorJoinMessage = (
  message: InitiatorMessage
): message is InitiatorJoinMessage => message.type === 'initiator-join';

export const isReceiverAckMessage = (
  message: ReceiverMessage
): message is ReceiverAckMessage => message.type === 'receiver-ack';

export const createInitiatorJoinMessage = (
  senderId: PeerId,
  peerMetadata: PeerMetadata,
  targetId: PeerId
): InitiatorJoinMessage => {
  return {
    type: 'initiator-join',
    senderId,
    peerMetadata,
    targetId,
  };
};

export const createReceiverAckMessage = (
  senderId: PeerId,
  peerMetadata: PeerMetadata,
  targetId: PeerId
): ReceiverAckMessage => {
  return {
    type: 'receiver-ack',
    senderId,
    peerMetadata,
    targetId,
  };
};
