import { useMemo } from 'react';

import {
  inferPlainTextLanguageFromExtension,
  plainTextLanguages,
} from '../../../../modules/domain/plain-text';
import { createAdapter as createYamlLinterAdapter } from '../../../../modules/domain/plain-text/adapters/yaml-linter';

// A plain-text file's language, from its name, and the linter for it, if any.
export const usePlainTextLanguage = (fileName: string) => {
  const language = inferPlainTextLanguageFromExtension(fileName);
  const linter = useMemo(
    () =>
      language === plainTextLanguages.YAML ? createYamlLinterAdapter() : null,
    [language]
  );

  return { language, linter };
};
