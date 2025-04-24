import { Schema } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { WasmContext } from '../../wasm';
import { createAdapter as createPandocDiffAdapter } from '../adapters/pandoc-diff';
import {
  type Diff,
  type ProseMirrorDiffArgs,
  type ProseMirrorDiffResult,
} from '../ports/diff';

type ProseMirrorContextType = {
  schema: Schema | null;
  setSchema: (schema: Schema) => void;
  view: EditorView | null;
  setView: (view: EditorView) => void;
  proseMirrorDiff: (
    args: ProseMirrorDiffArgs
  ) => Promise<ProseMirrorDiffResult>;
  diffAdapterReady: boolean;
};

export const ProseMirrorContext = createContext<ProseMirrorContextType>({
  view: null,
  schema: null,
  setView: () => {},
  setSchema: () => {},
  // @ts-expect-error will get overriden below
  proseMirrorDiff: () => null,
  diffAdapterReady: false,
});

export const ProseMirrorProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { runWasiCLI } = useContext(WasmContext);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [diffAdapter, setDiffAdapter] = useState<Diff | null>(null);

  useEffect(() => {
    const adapter = createPandocDiffAdapter({ runWasiCLI });
    setDiffAdapter(adapter);
  }, [runWasiCLI]);

  const handleSetSchema = useCallback((schema: Schema) => {
    setSchema(schema);
  }, []);

  const handleSetView = useCallback((view: EditorView) => {
    setView(view);
  }, []);

  const produceProseMirrorDiff = async (args: ProseMirrorDiffArgs) => {
    // TODO: Handle adapter readiness with a promise
    if (!diffAdapter) {
      throw new Error(
        'No diff adapter found when trying to produce the ProseMirror diff'
      );
    }

    return diffAdapter.proseMirrorDiff(args);
  };

  return (
    <ProseMirrorContext.Provider
      value={{
        schema,
        setSchema: handleSetSchema,
        view,
        setView: handleSetView,
        proseMirrorDiff: produceProseMirrorDiff,
        diffAdapterReady: Boolean(diffAdapter),
      }}
    >
      {children}
    </ProseMirrorContext.Provider>
  );
};
