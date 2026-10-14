import { useContext, useEffect, useMemo } from 'react';

import { uniqueParticipants } from '../../../../modules/domain/collaboration';
import {
  GuestEditingContext,
  useGuestPlainTextDocument,
  useRemotePresence,
} from '../../app-state';
import { LivePlainTextDocumentEditor } from '../../components/plain-text-editing/LivePlainTextDocumentEditor';
import { usePlainTextLanguage } from '../../components/plain-text-editing/use-plain-text-language';
import { LongTextSkeleton } from '../../components/progress/skeletons/LongText';
import { PlainTextActionsBar } from '../shared/document-actions-bar';

export const GuestPlainTextDocumentEditor = () => {
  const { name, onOpenSharingDialog } = useContext(GuestEditingContext);
  const plainTextDocument = useGuestPlainTextDocument();
  // The share's own name keeps its extension, which tells the language.
  const { language, linter } = usePlainTextLanguage(
    plainTextDocument?.liveDocument.name ?? ''
  );
  const peers = useRemotePresence(plainTextDocument?.liveDocument ?? null);
  const participants = useMemo(
    () => uniqueParticipants(peers.map((peer) => peer.participant)),
    [peers]
  );

  useEffect(() => {
    window.document.title = name ? `v2 | ${name}` : 'v2 | Shared with me';
  }, [name]);

  return (
    <div className="relative flex flex-auto flex-col overflow-hidden">
      <div className="w-full">
        <PlainTextActionsBar
          isShared
          participants={participants}
          onShareClick={onOpenSharingDialog}
          commitAction={null}
        />
      </div>

      <div className="flex min-h-0 w-full flex-auto flex-col">
        {plainTextDocument ? (
          <LivePlainTextDocumentEditor
            liveDocument={plainTextDocument.liveDocument}
            onLocalSelectionChange={plainTextDocument.onLocalSelectionChange}
            language={language}
            linter={linter}
          />
        ) : (
          <LongTextSkeleton />
        )}
      </div>
    </div>
  );
};
