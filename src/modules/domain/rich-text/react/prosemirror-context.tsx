import { type Node, type Schema } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { WasmContext } from '../../../../modules/infrastructure/wasm/react/wasm-context';
import { createAdapter as createPandocDiffAdapter } from '../adapters/pandoc-diff';
import {
  richTextRepresentations,
  type TextRichTextRepresentation,
} from '../constants/representations';
import { RichTextDocument } from '../models';
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
  setView: (view: EditorView | null) => void;
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

  const handleSetView = useCallback((view: EditorView | null) => {
    setView(view);
  }, []);

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

    // If the document content is empty, return a minimal ProseMirror document
    // consisting of the root `doc` node with a single empty `paragraph` child.
    if (!args.document.content) {
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
        input: args.document.content,
      });

      type RepresentationTransformPMOutput = {
        doc: PMNode;
      };

      const parsedOutput = JSON.parse(
        result
      ) as RepresentationTransformPMOutput;

      const pmDoc = pmDocFromJSONString(parsedOutput.doc, args.schema);

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

    const pmDoc = pmDocFromJSONString(parsedOutput.doc, schema);

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
