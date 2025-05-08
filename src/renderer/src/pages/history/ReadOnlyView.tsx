import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useContext, useEffect, useRef } from 'react';

import { prosemirror } from '../../../../modules/rich-text';
import { richTextRepresentations } from '../../../../modules/rich-text';
import { ProseMirrorContext } from '../../../../modules/rich-text/react/context';
import {
  getSpansString,
  type VersionedDocument,
} from '../../../../modules/version-control';
import {
  diffDelete,
  diffInsert,
  diffModify,
} from '../../components/editing/marks';

const { automergeSchemaAdapter, diffPlugin } = prosemirror;

export type DiffViewProps = {
  docBefore: VersionedDocument;
  docAfter: VersionedDocument;
};

export type SingleDocViewProps = {
  doc: VersionedDocument;
};

const isDiffViewProps = (
  props: DiffViewProps | SingleDocViewProps
): props is DiffViewProps => {
  return (
    (props as DiffViewProps).docBefore !== undefined &&
    (props as DiffViewProps).docAfter !== undefined
  );
};

const isSingleDocViewProps = (
  props: DiffViewProps | SingleDocViewProps
): props is SingleDocViewProps => {
  return (props as SingleDocViewProps).doc !== undefined;
};

type ReadOnlyViewProps = DiffViewProps | SingleDocViewProps;

export const ReadOnlyView = (props: ReadOnlyViewProps) => {
  const editorRoot = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const {
    proseMirrorDiff,
    diffAdapterReady,
    convertToProseMirror,
    representationTransformAdapterReady,
  } = useContext(ProseMirrorContext);

  // This effect is used to create the ProseMirror view once.
  // Then, every time the document or diff changes, we update the state of the view.
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

    const produceAndShowDiff = async () => {
      if (!viewRef.current || !isDiffViewProps(props)) return;

      const { schema } = automergeSchemaAdapter;
      const spansBefore = getSpansString(props.docBefore);
      const spansAfter = getSpansString(props.docAfter);
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
      produceAndShowDiff();
    }

    return () => {
      destroyed = true;
    };
  }, [props, proseMirrorDiff, diffAdapterReady]);

  useEffect(() => {
    let destroyed = false;

    const versionedDocToProseMirror = async () => {
      if (!viewRef.current || !isSingleDocViewProps(props)) return;

      const { schema } = automergeSchemaAdapter;
      const pmDoc = await convertToProseMirror({
        schema: schema,
        spans: getSpansString(props.doc),
      });

      if (destroyed) return;

      const state = EditorState.create({
        schema,
        doc: pmDoc,
      });

      viewRef.current.updateState(state);
    };

    // TODO: Handle adapter readiness with a promise
    if (representationTransformAdapterReady) {
      versionedDocToProseMirror();
    }

    return () => {
      destroyed = true;
    };
  }, [props, convertToProseMirror, representationTransformAdapterReady]);

  return <div className="flex-auto p-4" id="editor" ref={editorRoot} />;
};
