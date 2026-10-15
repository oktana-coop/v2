import { describe, expect, it } from 'vitest';

import {
  inferPlainTextLanguageFromExtension,
  plainTextLanguages,
} from './language';

describe('inferPlainTextLanguageFromExtension', () => {
  it.each([
    { path: 'config.yaml', language: plainTextLanguages.YAML },
    { path: 'config.yml', language: plainTextLanguages.YAML },
    { path: 'ci/WORKFLOW.YML', language: plainTextLanguages.YAML },
    { path: 'package.json', language: plainTextLanguages.JSON },
    { path: 'index.js', language: plainTextLanguages.JAVASCRIPT },
    { path: 'index.mjs', language: plainTextLanguages.JAVASCRIPT },
    { path: 'index.cjs', language: plainTextLanguages.JAVASCRIPT },
    { path: 'App.jsx', language: plainTextLanguages.JAVASCRIPT },
    { path: 'index.ts', language: plainTextLanguages.TYPESCRIPT },
    { path: 'index.mts', language: plainTextLanguages.TYPESCRIPT },
    { path: 'index.cts', language: plainTextLanguages.TYPESCRIPT },
    { path: 'App.tsx', language: plainTextLanguages.TSX },
    { path: 'index.html', language: plainTextLanguages.HTML },
    { path: 'INDEX.HTM', language: plainTextLanguages.HTML },
    { path: 'styles/main.css', language: plainTextLanguages.CSS },
  ])('recognizes $path as $language', ({ path, language }) => {
    expect(inferPlainTextLanguageFromExtension(path)).toBe(language);
  });

  it.each(['notes.txt', 'Makefile', 'yaml', 'data.jsonl'])(
    'treats %s as plain text',
    (path) => {
      expect(inferPlainTextLanguageFromExtension(path)).toBe(
        plainTextLanguages.PLAIN_TEXT
      );
    }
  );
});
