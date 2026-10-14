import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { useContext, useMemo } from 'react';

import {
  type Linter,
  type PlainTextLanguage,
} from '../../../../modules/domain/plain-text';
import { liveSync } from '../../../../modules/domain/plain-text/codemirror';
import { type LivePlainTextDocument } from '../../../../modules/domain/project';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type ContentBinding,
  PlainTextEditorBase,
} from './PlainTextEditorBase';

export type LivePlainTextDocumentEditorProps = {
  liveDocument: Pick<LivePlainTextDocument, 'content' | 'edit'>;
  language: PlainTextLanguage;
  linter: Linter | null;
};

export const LivePlainTextDocumentEditor = ({
  liveDocument,
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDocument]);

  return (
    <PlainTextEditorBase
      binding={binding}
      language={language}
      linter={linter}
    />
  );
};
