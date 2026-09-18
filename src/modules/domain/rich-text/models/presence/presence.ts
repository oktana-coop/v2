import { type Participant } from './participant';
import { type ParticipantSelection } from './participant-selection';

// What a peer says about themselves: who they are, and where they are in
// the document.
export type LocalPresence = {
  participant: Participant;
  selection: ParticipantSelection | null;
};

// One per peer; a person can be present as more than one peer.
export type RemotePresence = LocalPresence & { peerId: string };
