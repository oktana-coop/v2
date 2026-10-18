import * as Effect from 'effect/Effect';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AuthContext } from '../../../../modules/auth/browser';
import {
  anonymousParticipantName,
  type LiveDocument,
  type Participant,
  type RemotePresence,
} from '../../../../modules/domain/collaboration';
import { subscribeToRef } from '../../../../utils/effect';

// Generated once per app window, so an anonymous name lasts while the window
// is open, and each window of the same person gets its own.
const anonymousName = anonymousParticipantName(crypto.randomUUID());

export const useLocalParticipant = (): Participant => {
  const { username, email, githubUserInfo } = useContext(AuthContext);

  return useMemo(
    () => ({
      name: username ?? anonymousName,
      email,
      avatarUrl: githubUserInfo?.avatarUrl ?? null,
    }),
    [username, email, githubUserInfo]
  );
};

type DocumentWithPresence<ParticipantSelectionType> = Pick<
  LiveDocument<unknown, ParticipantSelectionType>,
  'presence'
>;

export const usePublishLocalPresence = <ParticipantSelectionType>(
  liveDocument: DocumentWithPresence<ParticipantSelectionType> | null
) => {
  const participant = useLocalParticipant();
  // Read through a ref, so the returned function only changes with the
  // document: the editor is bound to it, and a new binding re-seeds the
  // editor.
  const participantRef = useRef(participant);

  // A selection only means something in the document it was made in.
  const lastSelection = useRef<{
    document: DocumentWithPresence<ParticipantSelectionType>;
    selection: ParticipantSelectionType | null;
  } | null>(null);

  const publish = useCallback(
    (selection: ParticipantSelectionType | null) => {
      if (!liveDocument) return;

      lastSelection.current = { document: liveDocument, selection };
      Effect.runPromise(
        liveDocument.presence.publish({
          participant: participantRef.current,
          selection,
        })
      ).catch(console.error);
    },
    [liveDocument]
  );

  useEffect(() => {
    participantRef.current = participant;

    const last = lastSelection.current;
    publish(last?.document === liveDocument ? last.selection : null);
  }, [publish, liveDocument, participant]);

  return publish;
};

export const useRemotePresence = <ParticipantSelectionType>(
  liveDocument: DocumentWithPresence<ParticipantSelectionType> | null
): ReadonlyArray<RemotePresence<ParticipantSelectionType>> => {
  const [peers, setPeers] = useState<
    ReadonlyArray<RemotePresence<ParticipantSelectionType>>
  >([]);

  useEffect(() => {
    if (!liveDocument) {
      setPeers([]);
      return;
    }

    return subscribeToRef(liveDocument.presence.peers, setPeers);
  }, [liveDocument]);

  return peers;
};
