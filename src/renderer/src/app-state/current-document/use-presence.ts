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
import { type ParticipantSelection } from '../../../../modules/domain/rich-text';
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

type DocumentWithPresence = Pick<
  LiveDocument<unknown, ParticipantSelection>,
  'presence'
>;

export const usePublishLocalPresence = (
  liveDocument: DocumentWithPresence | null
) => {
  const participant = useLocalParticipant();
  // Read through a ref, so the returned function only changes with the
  // document: the editor is bound to it, and a new binding re-seeds the
  // editor.
  const participantRef = useRef(participant);

  // A selection only means something in the document it was made in.
  const lastSelection = useRef<{
    document: DocumentWithPresence;
    selection: ParticipantSelection | null;
  } | null>(null);

  const publish = useCallback(
    (selection: ParticipantSelection | null) => {
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

export const useRemotePresence = (
  liveDocument: DocumentWithPresence | null
): ReadonlyArray<RemotePresence<ParticipantSelection>> => {
  const [peers, setPeers] = useState<
    ReadonlyArray<RemotePresence<ParticipantSelection>>
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
