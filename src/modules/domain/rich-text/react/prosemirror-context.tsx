import { type Node, type Schema } from 'prosemirror-model';
import { type EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { WasmContext } from '../../../../modules/infrastructure/wasm/react/wasm-context';
import { createAdapter as createPandocDiffAdapter } from '../adapters/pandoc-diff';
import {
  getDocumentRichTextContent,
  RichTextDocument,
  richTextRepresentations,
  type TextRichTextRepresentation,
} from '../models';
import {
  type Diff,
  type ProseMirrorDiffArgs,
  type ProseMirrorDiffResult,
} from '../ports/diff';
import { pmDocFromJSONString, pmDocToJSONString } from '../prosemirror';
import { type PMNode } from '../prosemirror/hs-lib';
import { RepresentationTransformContext } from './representation-transform-context';

export type ConvertToProseMirrorArgs = {
  schema: Schema;
  document: RichTextDocument;
};

export type ConvertFromProseMirrorArgs = {
  pmDoc: Node;
  to: TextRichTextRepresentation;
};

export type ProseMirrorContextType = {
  view: EditorView | null;
  setView: (view: EditorView) => void;
  clearViewIfCurrent: (view: EditorView) => void;
  // The owner of the view calls onViewStateChange whenever it puts a new state on the view
  onViewStateChange: () => void;
  subscribeToViewState: (listener: () => void) => () => void;
  getViewState: () => EditorState | null;
  proseMirrorDiff: (
    args: ProseMirrorDiffArgs
  ) => Promise<ProseMirrorDiffResult>;
  diffAdapterReady: boolean;
  convertToProseMirror: (args: ConvertToProseMirrorArgs) => Promise<Node>;
  convertFromProseMirror: (args: ConvertFromProseMirrorArgs) => Promise<string>;
  parseMarkdown: (schema: Schema) => (input: string) => Promise<Node>;
  representationTransformAdapterReady: boolean;
};

export const ProseMirrorContext = createContext<ProseMirrorContextType>({
  view: null,
  setView: () => {},
  clearViewIfCurrent: () => {},
  subscribeToViewState: () => () => {},
  getViewState: () => null,
  onViewStateChange: () => {},
  // @ts-expect-error will get overriden below
  proseMirrorDiff: () => null,
  // @ts-expect-error will get overriden below
  parseMarkdown: () => null,
  diffAdapterReady: false,
});

export const ProseMirrorProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { runWasiCLIOutputingText } = useContext(WasmContext);
  const [view, setView] = useState<EditorView | null>(null);
  const [diffAdapter, setDiffAdapter] = useState<Diff | null>(null);
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const { dispatchNotification } = useContext(NotificationsContext);

  useEffect(() => {
    const pandocDiffAdapter = createPandocDiffAdapter({
      runWasiCLIOutputingText,
    });
    setDiffAdapter(pandocDiffAdapter);
  }, [runWasiCLIOutputingText]);

  const handleSetView = useCallback((view: EditorView) => {
    setView(view);
  }, []);

  // Clears the view only if the context still holds that exact view, so a
  // teardown never clears a view announced by someone else in the meantime.
  const handleClearViewIfCurrent = useCallback((viewToClear: EditorView) => {
    setView((current) => (current === viewToClear ? null : current));
  }, []);

  // Listeners live in a ref: a state change must reach subscribers without
  // re-rendering every context consumer.
  const viewStateListeners = useRef<Set<() => void>>(new Set());

  const handleSubscribeToViewState = useCallback((listener: () => void) => {
    viewStateListeners.current.add(listener);
    return () => {
      viewStateListeners.current.delete(listener);
    };
  }, []);

  const handleViewStateChange = useCallback(() => {
    viewStateListeners.current.forEach((listener) => listener());
  }, []);

  const handleGetViewState = useCallback(() => view?.state ?? null, [view]);

  const produceProseMirrorDiff = useCallback(
    async (args: ProseMirrorDiffArgs) => {
      // TODO: Handle adapter readiness with a promise
      if (!diffAdapter) {
        throw new Error(
          'No diff adapter found when trying to produce the ProseMirror diff'
        );
      }

      return diffAdapter.proseMirrorDiff(args);
    },
    [diffAdapter]
  );

  const handleConvertToProseMirror = async (args: ConvertToProseMirrorArgs) => {
    // TODO: Handle adapter readiness with a promise
    if (!representationTransformAdapter) {
      throw new Error(
        'No representation transform adapter found when trying to convert to ProseMirror'
      );
    }

    const content = getDocumentRichTextContent(args.document);

    // If the document content is empty, return a minimal ProseMirror document
    // consisting of the root `doc` node with a single empty `paragraph` child.
    if (!content) {
      const emptyParagraphDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [],
          },
        ],
      };

      const pmDoc = pmDocFromJSONString(emptyParagraphDoc, args.schema);

      return pmDoc;
    }

    try {
      const result = await representationTransformAdapter.transformToText({
        from: args.document.representation,
        to: richTextRepresentations.PROSEMIRROR,
        input: content,
      });

      type RepresentationTransformPMOutput = PMNode;

      const parsedOutput = JSON.parse(
        result
      ) as RepresentationTransformPMOutput;

      const pmDoc = pmDocFromJSONString(parsedOutput, args.schema);

      return pmDoc;
    } catch (error) {
      const notification = createErrorNotification({
        title: 'Error Reading Document',
        message: `An error happened when the editor tried to read the document. Please reach out to us for
    support.`,
      });
      dispatchNotification(notification);
      throw error;
    }
  };

  const handleParseMarkdown = (schema: Schema) => async (input: string) => {
    // TODO: Handle adapter readiness with a promise
    if (!representationTransformAdapter) {
      throw new Error(
        'No representation transform adapter found when trying to convert to ProseMirror'
      );
    }

    const result = await representationTransformAdapter.transformToText({
      from: richTextRepresentations.MARKDOWN,
      to: richTextRepresentations.PROSEMIRROR,
      input,
    });

    type RepresentationTransformPMOutput = {
      doc: PMNode;
    };

    let parsedOutput;

    try {
      parsedOutput = JSON.parse(result) as RepresentationTransformPMOutput;
    } catch (error) {
      throw new Error(
        `Failed to parse output from representation transform adapter: ${error}`
      );
    }

    const pmDoc = pmDocFromJSONString(parsedOutput, schema);

    return pmDoc;
  };

  const handleConvertFromProseMirror = async (
    args: ConvertFromProseMirrorArgs
  ) => {
    // TODO: Handle adapter readiness with a promise
    if (!representationTransformAdapter) {
      throw new Error(
        'No representation transform adapter found when trying to convert from ProseMirror'
      );
    }

    return representationTransformAdapter.transformToText({
      from: richTextRepresentations.PROSEMIRROR,
      to: args.to,
      input: pmDocToJSONString(args.pmDoc),
    });
  };

  return (
    <ProseMirrorContext.Provider
      value={{
        view,
        setView: handleSetView,
        clearViewIfCurrent: handleClearViewIfCurrent,
        subscribeToViewState: handleSubscribeToViewState,
        getViewState: handleGetViewState,
        onViewStateChange: handleViewStateChange,
        proseMirrorDiff: produceProseMirrorDiff,
        diffAdapterReady: Boolean(diffAdapter),
        convertToProseMirror: handleConvertToProseMirror,
        convertFromProseMirror: handleConvertFromProseMirror,
        representationTransformAdapterReady: Boolean(
          representationTransformAdapter
        ),
        parseMarkdown: handleParseMarkdown,
      }}
    >
      {children}
    </ProseMirrorContext.Provider>
  );
};
