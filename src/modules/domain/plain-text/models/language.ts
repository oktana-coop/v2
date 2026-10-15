import type { ValueOf } from 'type-fest';

import { getExtension } from '../../../infrastructure/filesystem';

export const plainTextLanguages = {
  PLAIN_TEXT: 'PLAIN_TEXT',
  YAML: 'YAML',
  JSON: 'JSON',
  JAVASCRIPT: 'JAVASCRIPT',
  TYPESCRIPT: 'TYPESCRIPT',
  TSX: 'TSX',
  HTML: 'HTML',
  CSS: 'CSS',
} as const;

export type PlainTextLanguage = ValueOf<typeof plainTextLanguages>;

const languagesByExtension: Record<string, PlainTextLanguage> = {
  yaml: plainTextLanguages.YAML,
  yml: plainTextLanguages.YAML,
  json: plainTextLanguages.JSON,
  js: plainTextLanguages.JAVASCRIPT,
  mjs: plainTextLanguages.JAVASCRIPT,
  cjs: plainTextLanguages.JAVASCRIPT,
  jsx: plainTextLanguages.JAVASCRIPT,
  ts: plainTextLanguages.TYPESCRIPT,
  mts: plainTextLanguages.TYPESCRIPT,
  cts: plainTextLanguages.TYPESCRIPT,
  tsx: plainTextLanguages.TSX,
  html: plainTextLanguages.HTML,
  htm: plainTextLanguages.HTML,
  css: plainTextLanguages.CSS,
};

export const inferPlainTextLanguageFromExtension = (
  path: string
): PlainTextLanguage =>
  languagesByExtension[getExtension(path).toLowerCase()] ??
  plainTextLanguages.PLAIN_TEXT;
