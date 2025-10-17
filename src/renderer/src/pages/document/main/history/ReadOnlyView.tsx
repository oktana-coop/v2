import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useContext, useEffect, useRef } from 'react';

import {
  prosemirror,
  type RichTextDocument,
  richTextRepresentations,
} from '../../../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../../../modules/domain/rich-text/react/prosemirror-context';
import { ElectronContext } from '../../../../../../modules/infrastructure/cross-platform';
import { CurrentDocumentContext } from '../../../../app-state';
import {
  diffDelete,
  diffInsert,
  diffModify,
} from '../../../../components/editing/marks';

const { schema, diffPlugin, notesPlugin, numberNotes, openExternalLinkPlugin } =
  prosemirror;

export type DiffViewProps = {
  docBefore: RichTextDocument;
  docAfter: RichTextDocument;
};

export type SingleDocViewProps = {
  doc: RichTextDocument;
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
  const { openExternalLink } = useContext(ElectronContext);
  const editorRoot = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const {
    proseMirrorDiff,
    diffAdapterReady,
    convertToProseMirror,
    representationTransformAdapterReady,
  } = useContext(ProseMirrorContext);
  const { getDocumentRichTextContent } = useContext(CurrentDocumentContext);

  // This effect is used to create the ProseMirror view once.
  // Then, every time the document or diff changes, we update the state of the view.
  useEffect(() => {
    if (!editorRoot.current || viewRef.current) return;

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

      const contentBefore = await getDocumentRichTextContent(props.docBefore);
      const contentAfter = await getDocumentRichTextContent(props.docAfter);

      const { pmDocAfter: pmDoc, decorations } = await proseMirrorDiff({
        representation: richTextRepresentations.AUTOMERGE,
        proseMirrorSchema: schema,
        decorationClasses: {
          insert: diffInsert,
          modify: diffModify,
          delete: diffDelete,
        },
        docBefore: contentBefore,
        docAfter: contentAfter,
      });

      if (destroyed) return;

      const state = EditorState.create({
        schema,
        doc: pmDoc,
        plugins: [
          openExternalLinkPlugin(openExternalLink),
          diffPlugin({ decorations }),
          notesPlugin(),
        ],
      });

      numberNotes(state, viewRef.current.dispatch, viewRef.current);
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

      const richTextContent = await getDocumentRichTextContent(props.doc);

      const pmDoc = await convertToProseMirror({
        schema: schema,
        document: {
          ...props.doc,
          // There are some old document versions without the representataion set. So the TS type is not completely accurate for all historical versions of a document.
          // But we should be able to remove this check really soon (don't expect many people to have v2 versions < 0.6.6)
          representation:
            props.doc.representation ?? richTextRepresentations.AUTOMERGE,
          content: richTextContent,
        },
      });

      if (destroyed) return;

      const state = EditorState.create({
        schema,
        doc: pmDoc,
        plugins: [openExternalLinkPlugin(openExternalLink), notesPlugin()],
      });

      numberNotes(state, viewRef.current.dispatch, viewRef.current);
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

  return <div className="editor flex-auto p-4" id="editor" ref={editorRoot} />;
};
