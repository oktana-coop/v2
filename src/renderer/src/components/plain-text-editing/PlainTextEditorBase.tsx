import { type Extension } from '@codemirror/state';
import { useMemo } from 'react';

import {
  type Linter,
  type PlainTextLanguage,
} from '../../../../modules/domain/plain-text';
import {
  editing,
  lint,
} from '../../../../modules/domain/plain-text/codemirror';
import { CodeMirrorEditor, type EditorSeed } from './CodeMirrorEditor';

// How the editor is bound to its content: the text it starts with, the
// extension that carries editor changes back, and the presence extension when
// others can be at the document.
export type ContentBinding = {
  doc: string;
  syncExtension: Extension;
  presenceExtension?: Extension;
};

type PlainTextEditorBaseProps = {
  binding: ContentBinding;
  language: PlainTextLanguage;
  linter: Linter | null;
};

// The editing layer: everything that turns a rendered document into an
// editable one. Read-only views skip this layer and use CodeMirrorEditor
// directly.
export const PlainTextEditorBase = ({
  binding,
  language,
  linter,
}: PlainTextEditorBaseProps) => {
  const seed = useMemo(
    (): EditorSeed => ({
      doc: binding.doc,
      language,
      extensions: [
        editing,
        linter ? lint(linter) : [],
        binding.syncExtension,
        binding.presenceExtension ?? [],
      ],
    }),
    [binding, language, linter]
  );

  return <CodeMirrorEditor seed={seed} />;
};
