import { type Participant } from './participant';

// What a peer says about themselves: who they are, and where they are in
// the document, as their kind of document's editor puts it.
export type LocalPresence<ParticipantSelectionType> = {
  participant: Participant;
  selection: ParticipantSelectionType | null;
};

// One per peer; a person can be present as more than one peer.
export type RemotePresence<ParticipantSelectionType> =
  LocalPresence<ParticipantSelectionType> & {
    peerId: string;
  };
