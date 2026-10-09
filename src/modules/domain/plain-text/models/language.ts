import type { ValueOf } from 'type-fest';

import { getExtension } from '../../../infrastructure/filesystem';

const PLAIN_TEXT = 'PLAIN_TEXT';
const YAML = 'YAML';

export const plainTextLanguages = {
  PLAIN_TEXT,
  YAML,
} as const;

export type PlainTextLanguage = ValueOf<typeof plainTextLanguages>;

const languagesByExtension: Record<string, PlainTextLanguage> = {
  yaml: plainTextLanguages.YAML,
  yml: plainTextLanguages.YAML,
};

export const inferPlainTextLanguageFromExtension = (
  path: string
): PlainTextLanguage =>
  languagesByExtension[getExtension(path).toLowerCase()] ??
  plainTextLanguages.PLAIN_TEXT;
