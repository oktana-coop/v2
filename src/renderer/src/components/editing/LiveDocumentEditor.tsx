import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Schema } from 'prosemirror-model';
import { useCallback, useContext } from 'react';

import {
  type LiveDocument,
  prosemirror,
  type RichTextDocument,
  richTextRepresentations,
} from '../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type ContentBinding,
  EditorBase,
  type SharedEditorProps,
} from './EditorBase';

const { liveSyncPlugin, pmDocFromJSONString } = prosemirror;

// Backed by a live document: always editable, content owned outside the editor.
export type LiveDocumentEditorProps = SharedEditorProps & {
  liveDocument: LiveDocument;
};

export const LiveDocumentEditor = ({
  liveDocument,
  ...shared
}: LiveDocumentEditorProps) => {
  const { convertToProseMirror } = useContext(ProseMirrorContext);
  const { dispatchNotification } = useContext(NotificationsContext);

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

  const bindContent = useCallback(
    async (schema: Schema): Promise<ContentBinding> => {
      // One snapshot feeds both the initial doc and the plugin's initial
      // version, so they cannot disagree.
      const initial = Effect.runSync(SubscriptionRef.get(liveDocument.content));

      const pmDoc =
        initial.doc.representation === richTextRepresentations.PROSEMIRROR
          ? pmDocFromJSONString(JSON.parse(initial.doc.content), schema)
          : await convertToProseMirror({ schema, document: initial.doc });

      const syncPlugin = liveSyncPlugin({
        liveDocument,
        initialVersion: initial.version,
        schemaVersion: initial.doc.schemaVersion,
        schema,
        convertToProseMirror: (document: RichTextDocument) =>
          convertToProseMirror({ schema, document }),
        onError: handleLiveSyncError,
      });

      return { pmDoc, sourceDoc: initial.doc, syncPlugin };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveDocument]
  );

  return <EditorBase bindContent={bindContent} {...shared} />;
};
