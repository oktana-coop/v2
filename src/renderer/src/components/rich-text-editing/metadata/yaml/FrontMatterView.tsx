import { useMemo } from 'react';

import { plainTextLanguages } from '../../../../../../modules/domain/plain-text';
import {
  diffWith,
  readOnly,
} from '../../../../../../modules/domain/plain-text/codemirror';
import {
  CodeMirrorEditor,
  type EditorSeed,
} from '../../../plain-text-editing/CodeMirrorEditor';
import { fittedToText } from './theme';

// The front matter as YAML, read-only.
export const FrontMatterView = ({
  frontMatter,
  diffBase,
}: {
  frontMatter: string | null;
  // The front matter to show the changes against, if any.
  diffBase: string | null;
}) => {
  const seed = useMemo(
    (): EditorSeed => ({
      doc: frontMatter ?? '',
      language: plainTextLanguages.YAML,
      extensions: [
        readOnly,
        fittedToText,
        diffBase === null ? [] : diffWith(diffBase),
      ],
    }),
    [frontMatter, diffBase]
  );

  return <CodeMirrorEditor seed={seed} />;
};
