import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useContext, useEffect, useRef } from 'react';

import { type PlainTextLanguage } from '../../../../modules/domain/plain-text';
import {
  darkTheme,
  display,
  languageSupport,
  lightTheme,
} from '../../../../modules/domain/plain-text/codemirror';
import {
  ThemeContext,
  themes,
} from '../../../../modules/personalization/browser';

export type EditorSeed = {
  doc: string;
  language: PlainTextLanguage;
  extensions: Extension;
};

// This component owns the EditorView lifecycle. What the editor contains comes
// from the parent components as a seed. The first seed creates the view, once
// per mount; later seeds swap a fresh EditorState onto that same view.
export const CodeMirrorEditor = ({ seed }: { seed: EditorSeed }) => {
  const editorRoot = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const { resolvedTheme } = useContext(ThemeContext);
  const theme = resolvedTheme === themes.dark ? darkTheme : lightTheme;

  useEffect(() => {
    return () => {
      editorViewRef.current?.destroy();
      editorViewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = EditorState.create({
      doc: seed.doc,
      extensions: [
        display,
        languageSupport(seed.language),
        themeCompartment.current.of(theme),
        seed.extensions,
      ],
    });

    if (editorViewRef.current) {
      editorViewRef.current.setState(state);
      return;
    }

    editorViewRef.current = new EditorView({
      state,
      parent: editorRoot.current ?? undefined,
    });
    // The theme in use is read when the state is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    editorViewRef.current?.dispatch({
      effects: themeCompartment.current.reconfigure(theme),
    });
  }, [theme]);

  return (
    <div className="min-h-0 flex-auto [&>.cm-editor]:h-full" ref={editorRoot} />
  );
};
