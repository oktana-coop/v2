import {
  type Message,
  type PeerId,
  type PeerMetadata,
} from '@automerge/automerge-repo/slim';

import { type ProcessId } from './types';

/** Sent by the initiator to the receiver process to tell the receiver that the initiator's repo has been setup (and its peer ID) */
export type InitiatorJoinMessage = {
  type: 'initiator-join';
  /** The PeerID of the initiator */
  senderId: PeerId;
  /** Metadata presented by the peer  */
  peerMetadata: PeerMetadata;
};

export type RendererInitiatorJoinMessage = InitiatorJoinMessage & {
  processId: ProcessId;
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

export type RendererReceiverAckMessage = ReceiverAckMessage & {
  processId: ProcessId;
};

/** A message from the initiator to the receiver process */
export type InitiatorMessage = InitiatorJoinMessage | Message;

/** A message from the receiver to the initiator process */
export type ReceiverMessage = ReceiverAckMessage | Message;

export type FromMainMessage =
  | InitiatorJoinMessage
  | ReceiverAckMessage
  | Message;

export type FromRendererMessage =
  | RendererInitiatorJoinMessage
  | RendererReceiverAckMessage
  | Message;

export const isInitiatorJoinMessage = (
  message: InitiatorMessage
): message is InitiatorJoinMessage => message.type === 'initiator-join';

export const isRendererInitiatorJoinMessage = (
  message: InitiatorMessage
): message is InitiatorJoinMessage =>
  message.type === 'initiator-join' && 'processId' in message;

export const isReceiverAckMessage = (
  message: ReceiverMessage
): message is ReceiverAckMessage => message.type === 'receiver-ack';

export const isRendererReceiverAckMessage = (
  message: ReceiverMessage
): message is ReceiverAckMessage =>
  message.type === 'receiver-ack' && 'processId' in message;

export const createInitiatorJoinMessage = (
  senderId: PeerId,
  peerMetadata: PeerMetadata
): InitiatorJoinMessage => {
  return {
    type: 'initiator-join',
    senderId,
    peerMetadata,
  };
};

export const createRendererInitiatorJoinMessage = (
  senderId: PeerId,
  peerMetadata: PeerMetadata,
  processId: ProcessId
): RendererInitiatorJoinMessage => {
  return {
    type: 'initiator-join',
    senderId,
    peerMetadata,
    processId,
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

export const createRendererReceiverAckMessage = (
  senderId: PeerId,
  peerMetadata: PeerMetadata,
  targetId: PeerId,
  processId: ProcessId
): RendererReceiverAckMessage => {
  return {
    type: 'receiver-ack',
    senderId,
    peerMetadata,
    targetId,
    processId,
  };
};
