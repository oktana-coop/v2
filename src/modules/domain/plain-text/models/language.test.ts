import { describe, expect, it } from 'vitest';

import {
  inferPlainTextLanguageFromExtension,
  plainTextLanguages,
} from './language';

describe('inferPlainTextLanguageFromExtension', () => {
  it.each(['config.yaml', 'config.yml', 'ci/WORKFLOW.YML'])(
    'recognizes %s as YAML',
    (path) => {
      expect(inferPlainTextLanguageFromExtension(path)).toBe(
        plainTextLanguages.YAML
      );
    }
  );

  it.each(['notes.txt', 'data.json', 'Makefile', 'yaml'])(
    'treats %s as plain text',
    (path) => {
      expect(inferPlainTextLanguageFromExtension(path)).toBe(
        plainTextLanguages.PLAIN_TEXT
      );
    }
  );
});
