import { Schema } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { createContext, useCallback, useState } from 'react';

type ProseMirrorContextType = {
  schema: Schema | null;
  setSchema: (schema: Schema) => void;
  view: EditorView | null;
  setView: (view: EditorView) => void;
};

export const ProseMirrorContext = createContext<ProseMirrorContextType>({
  view: null,
  schema: null,
  setView: () => {},
  setSchema: () => {},
});

export const ProseMirrorProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [view, setView] = useState<EditorView | null>(null);

  const handleSetSchema = useCallback((schema: Schema) => {
    setSchema(schema);
  }, []);

  const handleSetView = useCallback((view: EditorView) => {
    setView(view);
  }, []);

  return (
    <ProseMirrorContext.Provider
      value={{
        schema,
        setSchema: handleSetSchema,
        view,
        setView: handleSetView,
      }}
    >
      {children}
    </ProseMirrorContext.Provider>
  );
};
