import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { type Extension } from '@codemirror/state';

import { type PlainTextLanguage, plainTextLanguages } from '../../models';
import { yamlSupport } from './yaml';

const supportByLanguage: Record<PlainTextLanguage, Extension> = {
  [plainTextLanguages.PLAIN_TEXT]: [],
  [plainTextLanguages.YAML]: yamlSupport,
  [plainTextLanguages.JSON]: json(),
  [plainTextLanguages.JAVASCRIPT]: javascript({ jsx: true }),
  [plainTextLanguages.TYPESCRIPT]: javascript({ typescript: true }),
  [plainTextLanguages.TSX]: javascript({
    typescript: true,
    jsx: true,
  }),
  [plainTextLanguages.HTML]: html(),
  [plainTextLanguages.CSS]: css(),
};

export const languageSupport = (language: PlainTextLanguage): Extension =>
  supportByLanguage[language];
