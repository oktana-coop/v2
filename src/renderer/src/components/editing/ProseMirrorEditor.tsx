import { type Node, type Schema } from 'prosemirror-model';
import { EditorState, type Plugin, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useContext, useEffect, useRef } from 'react';

import { prosemirror } from '../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../modules/domain/rich-text/react/prosemirror-context';

const { schema, registerNodeViews } = prosemirror;

export type EditorSeed = {
  doc: Node;
  plugins: Plugin[];
};

export type ProseMirrorEditorProps = {
  seed: EditorSeed;
  rebuildPlugins?: (args: {
    schema: Schema;
    currentDoc: Node;
  }) => Promise<Plugin[]>;
  isEditable?: boolean;
  // Whether to publish the view to the shared ProseMirrorContext.
  announceView?: boolean;
  onTransaction?: (args: { state: EditorState; tx: Transaction }) => void;
  onViewReady?: (args: { view: EditorView; state: EditorState }) => void;
};

// This component owns the EditorView lifecycle. What the editor contains comes
// from the parent components as a seed. The first seed creates the view, once
// per mount; later seeds swap a fresh EditorState onto that same view.
export const ProseMirrorEditor = ({
  seed,
  rebuildPlugins,
  isEditable = true,
  announceView = true,
  onTransaction,
  onViewReady,
}: ProseMirrorEditorProps) => {
  const editorRoot = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const { setView, clearViewIfCurrent } = useContext(ProseMirrorContext);

  // Owns the view for the lifetime of the mount.
  useEffect(() => {
    return () => {
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        clearViewIfCurrent(editorViewRef.current);
        editorViewRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const state = EditorState.create({
      schema,
      plugins: seed.plugins,
      doc: seed.doc,
    });

    const existingView = editorViewRef.current;
    if (existingView) {
      existingView.updateState(state);
      onViewReady?.({ view: existingView, state });
      return;
    }

    const editorView = new EditorView(editorRoot.current, {
      state,
      nodeViews: registerNodeViews(),
      dispatchTransaction: (tx: Transaction) => {
        const newState = editorView.state.apply(tx);
        editorView.updateState(newState);
        onTransaction?.({ state: newState, tx });
      },
      editable: () => isEditable,
    });

    editorViewRef.current = editorView;

    // Announce the view to the shared context only after creation.
    if (announceView) {
      setView(editorView);
    }

    onViewReady?.({ view: editorView, state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, setView]);

  useEffect(() => {
    const reconfigure = async () => {
      const editorView = editorViewRef.current;
      if (!editorView || !rebuildPlugins) return;

      const plugins = await rebuildPlugins({
        schema,
        currentDoc: editorView.state.doc,
      });

      // The view may have been torn down while the plugins were building.
      if (editorViewRef.current !== editorView) return;

      const newState = editorView.state.reconfigure({ plugins });
      editorView.updateState(newState);
    };

    reconfigure();
  }, [rebuildPlugins]);

  return (
    <div
      className="editor flex-auto font-editor"
      id="editor"
      ref={editorRoot}
    />
  );
};
