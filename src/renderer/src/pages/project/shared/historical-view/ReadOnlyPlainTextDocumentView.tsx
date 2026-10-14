import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useMemo } from 'react';

import {
  type PlainText,
  type PlainTextLanguage,
} from '../../../../../../modules/domain/plain-text';
import { diffWith } from '../../../../../../modules/domain/plain-text/codemirror';
import {
  CodeMirrorEditor,
  type EditorSeed,
} from '../../../../components/plain-text-editing/CodeMirrorEditor';

const readOnly: Extension = [
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
];

export const ReadOnlyPlainTextDocumentView = ({
  text,
  language,
  diffBase,
}: {
  text: PlainText;
  language: PlainTextLanguage;
  // The text to show the changes against, if any.
  diffBase: PlainText | null;
}) => {
  const seed = useMemo(
    (): EditorSeed => ({
      doc: text,
      language,
      extensions: [readOnly, diffBase === null ? [] : diffWith(diffBase)],
    }),
    [text, language, diffBase]
  );

  return <CodeMirrorEditor seed={seed} />;
};
