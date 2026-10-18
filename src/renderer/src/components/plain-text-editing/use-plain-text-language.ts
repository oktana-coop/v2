import { useMemo } from 'react';

import {
  inferPlainTextLanguageFromExtension,
  type Linter,
  type PlainTextLanguage,
  plainTextLanguages,
} from '../../../../modules/domain/plain-text';
import { createAdapter as createJsonLinterAdapter } from '../../../../modules/domain/plain-text/adapters/json-linter';
import { createAdapter as createYamlLinterAdapter } from '../../../../modules/domain/plain-text/adapters/yaml-linter';

const linterFor = (language: PlainTextLanguage): Linter | null => {
  if (language === plainTextLanguages.YAML) {
    return createYamlLinterAdapter();
  }

  if (language === plainTextLanguages.JSON) {
    return createJsonLinterAdapter();
  }

  return null;
};

// A plain-text file's language, from its name, and the linter for it, if any.
export const usePlainTextLanguage = (fileName: string) => {
  const language = inferPlainTextLanguageFromExtension(fileName);
  const linter = useMemo(() => linterFor(language), [language]);

  return { language, linter };
};
