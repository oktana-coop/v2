import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { useContext, useMemo } from 'react';

import {
  type Linter,
  type ParticipantSelection,
  type PlainTextLanguage,
} from '../../../../modules/domain/plain-text';
import {
  getLiveSyncState,
  liveSync,
  presence,
} from '../../../../modules/domain/plain-text/codemirror';
import { type LivePlainTextDocument } from '../../../../modules/domain/project';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { getColorClass, getSelectionColorClass } from '../user/color';
import {
  type ContentBinding,
  PlainTextEditorBase,
} from './PlainTextEditorBase';

export type LivePlainTextDocumentEditorProps = {
  liveDocument: Pick<LivePlainTextDocument, 'content' | 'edit' | 'presence'>;
  // Where the caret is, for whoever else is at the document.
  onLocalSelectionChange: (selection: ParticipantSelection | null) => void;
  language: PlainTextLanguage;
  linter: Linter | null;
};

export const LivePlainTextDocumentEditor = ({
  liveDocument,
  onLocalSelectionChange,
  language,
  linter,
}: LivePlainTextDocumentEditorProps) => {
  const { dispatchNotification } = useContext(NotificationsContext);

  const binding = useMemo((): ContentBinding => {
    const handleLiveSyncError = (error: unknown) => {
      console.error(error);
      dispatchNotification(
        createErrorNotification({
          title: 'Editor Sync Error',
          message:
            'An error happened while syncing this document. Please reach out to us for support.',
        })
      );
    };

    // One snapshot feeds both the initial text and the initial version, so
    // they cannot disagree.
    const initial = Effect.runSync(SubscriptionRef.get(liveDocument.content));

    return {
      doc: initial.doc.content,
      syncExtension: liveSync({
        content: liveDocument.content,
        onChange: liveDocument.edit,
        initialVersion: initial.version,
        onError: handleLiveSyncError,
      }),
      presenceExtension: presence({
        peers: liveDocument.presence.peers,
        readSyncState: getLiveSyncState,
        publish: onLocalSelectionChange,
        colorClassFor: (participant) => getColorClass(participant.name),
        selectionColorClassFor: (participant) =>
          getSelectionColorClass(participant.name),
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDocument, onLocalSelectionChange]);

  return (
    <PlainTextEditorBase
      binding={binding}
      language={language}
      linter={linter}
    />
  );
};
