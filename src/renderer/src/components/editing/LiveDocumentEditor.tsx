import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Schema } from 'prosemirror-model';
import { useCallback, useContext } from 'react';

import { type LiveDocument } from '../../../../modules/domain/project';
import {
  LiveSyncFallbackError,
  type ParticipantSelection,
  prosemirror,
  richTextRepresentations,
} from '../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { getColorClass } from '../user/color';
import {
  type ContentBinding,
  EditorBase,
  type SharedEditorProps,
} from './EditorBase';

const {
  liveSyncPlugin,
  getLiveSyncState,
  presencePlugin,
  pmDocFromJSONString,
} = prosemirror;

export type LiveDocumentEditorProps = SharedEditorProps & {
  liveDocument: LiveDocument;
  // Where the caret is, for whoever else is at the document.
  onLocalSelectionChange: (selection: ParticipantSelection | null) => void;
};

export const LiveDocumentEditor = ({
  liveDocument,
  onLocalSelectionChange,
  ...shared
}: LiveDocumentEditorProps) => {
  const { convertToProseMirror, proseMirrorSteps } =
    useContext(ProseMirrorContext);
  const { dispatchNotification } = useContext(NotificationsContext);

  const handleLiveSyncError = (error: unknown) => {
    // The document still converged; the coarser apply is a dev concern.
    if (error instanceof LiveSyncFallbackError) {
      console.warn(`Live sync fell back to a region replace: ${error.message}`);
      return;
    }

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
        content: liveDocument.content,
        onChange: liveDocument.change,
        initialVersion: initial.version,
        schemaVersion: initial.doc.schemaVersion,
        schema,
        proseMirrorSteps: ({ pmDocBefore, docAfter }) =>
          proseMirrorSteps({
            pmDocBefore,
            docAfter,
            proseMirrorSchema: schema,
          }),
        convertToProseMirror: (document) =>
          convertToProseMirror({ schema, document }),
        onError: handleLiveSyncError,
      });

      const presence = presencePlugin({
        peers: liveDocument.presence.peers,
        readSyncState: getLiveSyncState,
        publish: onLocalSelectionChange,
        colorClassFor: (participant) => getColorClass(participant.name),
      });

      return {
        pmDoc,
        sourceDoc: initial.doc,
        syncPlugin,
        presencePlugin: presence,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveDocument, onLocalSelectionChange]
  );

  return <EditorBase bindContent={bindContent} {...shared} />;
};
