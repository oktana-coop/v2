import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useContext, useEffect, useRef } from 'react';

import { prosemirror } from '../../../../modules/rich-text';
import { richTextRepresentations } from '../../../../modules/rich-text';
import { ProseMirrorContext } from '../../../../modules/rich-text/react/context';
import {
  convertToStorageFormat,
  type VersionedDocument,
} from '../../../../modules/version-control';
import {
  diffDelete,
  diffInsert,
  diffModify,
} from '../../components/editing/marks';

const { automergeSchemaAdapter, diffPlugin } = prosemirror;

export type DiffProps = {
  docBefore: VersionedDocument;
  docAfter: VersionedDocument;
};

type RichTextEditorProps = {
  diffProps: DiffProps;
};

export const DiffView = ({ diffProps }: RichTextEditorProps) => {
  const editorRoot = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { proseMirrorDiff, diffAdapterReady } = useContext(ProseMirrorContext);

  // This effect is used to create the ProseMirror view once.
  // Then, every time the diff changes, we update the state of the view.
  useEffect(() => {
    if (!editorRoot.current || viewRef.current) return;

    const { schema } = automergeSchemaAdapter;
    const state = EditorState.create({
      schema,
    });

    // Using a ref instead of a state variable to avoid re-rendering
    // the component every time the view changes.
    viewRef.current = new EditorView(editorRoot.current, {
      state,
      editable: () => false,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    let destroyed = false;

    const updateDiff = async () => {
      if (!viewRef.current) return;

      const { schema } = automergeSchemaAdapter;
      const spansBefore = convertToStorageFormat(diffProps.docBefore);
      const spansAfter = convertToStorageFormat(diffProps.docAfter);
      const { pmDocAfter: pmDoc, decorations } = await proseMirrorDiff({
        representation: richTextRepresentations.AUTOMERGE,
        proseMirrorSchema: schema,
        decorationClasses: {
          insert: diffInsert,
          modify: diffModify,
          delete: diffDelete,
        },
        docBefore: spansBefore,
        docAfter: spansAfter,
      });

      if (destroyed) return;

      const state = EditorState.create({
        schema,
        doc: pmDoc,
        plugins: [diffPlugin({ decorations })],
      });

      viewRef.current.updateState(state);
    };

    // TODO: Handle adapter readiness with a promise
    if (diffAdapterReady) {
      updateDiff();
    }

    return () => {
      destroyed = true;
    };
  }, [diffProps, proseMirrorDiff, diffAdapterReady]);

  return (
    <div className="flex flex-auto overflow-auto p-4 outline-none">
      <div className="flex-auto" id="editor" ref={editorRoot} />
    </div>
  );
};
