import { type Extension } from '@codemirror/state';

import { type PlainTextLanguage, plainTextLanguages } from '../../models';
import { yamlSupport } from './yaml';

const supportByLanguage: Record<PlainTextLanguage, Extension> = {
  [plainTextLanguages.PLAIN_TEXT]: [],
  [plainTextLanguages.YAML]: yamlSupport,
};

export const languageSupport = (language: PlainTextLanguage): Extension =>
  supportByLanguage[language];
