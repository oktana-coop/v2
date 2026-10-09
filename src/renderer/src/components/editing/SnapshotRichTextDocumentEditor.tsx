import debounce from 'debounce';
import { type Node, type Schema } from 'prosemirror-model';
import { useCallback, useContext } from 'react';

import {
  prosemirror,
  type RichTextDocument,
  richTextRepresentations,
} from '../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../modules/domain/rich-text/react/prosemirror-context';
import {
  type ContentBinding,
  RichTextEditorBase,
  type SharedEditorProps,
} from './RichTextEditorBase';

const { oneWaySyncPlugin, pmDocFromJSONString, pmDocToJSONString } =
  prosemirror;

// Backed by a document snapshot value: the editor renders what it is given and
// reports changes back through `onDocChange`. Keeping the snapshot fresh is the
// caller's responsibility.
export type SnapshotRichTextDocumentEditorProps = SharedEditorProps & {
  doc: RichTextDocument;
  onDocChange: (doc: RichTextDocument) => Promise<void>;
  showDiffWith?: RichTextDocument;
};

export const SnapshotRichTextDocumentEditor = ({
  doc,
  onDocChange,
  showDiffWith,
  ...shared
}: SnapshotRichTextDocumentEditorProps) => {
  const { convertToProseMirror } = useContext(ProseMirrorContext);

  const bindContent = useCallback(
    async (schema: Schema): Promise<ContentBinding> => {
      const pmDoc =
        doc.representation !== richTextRepresentations.PROSEMIRROR
          ? await convertToProseMirror({ schema, document: doc })
          : pmDocFromJSONString(doc.content, schema);

      const syncPlugin = oneWaySyncPlugin({
        onPMDocChange: debounce(async (pmDoc: Node) => {
          onDocChange({
            schemaVersion: doc.schemaVersion,
            representation: richTextRepresentations.PROSEMIRROR,
            content: pmDocToJSONString(pmDoc),
          });
        }, 300),
      });

      return { pmDoc, sourceDoc: doc, syncPlugin };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, onDocChange]
  );

  return (
    <RichTextEditorBase
      bindContent={bindContent}
      diffWith={showDiffWith}
      {...shared}
    />
  );
};
