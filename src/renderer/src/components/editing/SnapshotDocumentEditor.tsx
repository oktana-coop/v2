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
  EditorBase,
  type SharedEditorProps,
} from './EditorBase';

const { oneWaySyncPlugin, pmDocFromJSONString, pmDocToJSONString } =
  prosemirror;

// Backed by a document snapshot value: the editor renders what it is given and
// reports changes back through `onDocChange`. Keeping the snapshot fresh is the
// caller's responsibility.
export type SnapshotDocumentEditorProps = SharedEditorProps & {
  doc: RichTextDocument;
  onDocChange: (doc: RichTextDocument) => Promise<void>;
  showDiffWith?: RichTextDocument;
};

export const SnapshotDocumentEditor = ({
  doc,
  onDocChange,
  showDiffWith,
  ...shared
}: SnapshotDocumentEditorProps) => {
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
    <EditorBase bindContent={bindContent} diffWith={showDiffWith} {...shared} />
  );
};
