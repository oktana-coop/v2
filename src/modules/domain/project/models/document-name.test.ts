import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { describe, expect, it } from 'vitest';

import { VersionedProjectValidationErrorTag } from '../errors';
import { getNewDocumentName, parseDocumentNameEffect } from './document-name';

// The message the name is refused with, or null when it is accepted.
const errorMessage = (name: string): string | null =>
  Either.match(Effect.runSync(Effect.either(parseDocumentNameEffect(name))), {
    onLeft: (error) => {
      expect(error._tag).toBe(VersionedProjectValidationErrorTag);
      return error.message;
    },
    onRight: () => null,
  });

describe('parseDocumentNameEffect', () => {
  it.each([
    'notes.md',
    'notes.markdown',
    'config.yaml',
    'archive.tar.gz',
    'notes',
    'Makefile',
  ])('accepts %j', (name) => {
    expect(errorMessage(name)).toBeNull();
  });

  it.each(['.gitignore', '.notes.md'])(
    'refuses %j, which starts with a dot',
    (name) => {
      expect(errorMessage(name)).toMatch(/cannot start with a dot/);
    }
  );

  it('returns the name normalized to its composed form', () => {
    // café.md: given as `e` plus a combining accent, expected as a single `é`.
    const name = Effect.runSync(parseDocumentNameEffect('cafe\u0301.md'));

    expect(name).toBe('caf\u00e9.md');
  });

  it('refuses what the filesystem refuses, with its message', () => {
    expect(errorMessage('drafts/notes.md')).toMatch(/cannot contain \/ or \\/);
  });
});

describe('getNewDocumentName', () => {
  it('offers Untitled.md in an empty directory', () => {
    expect(getNewDocumentName({ namesInDirectory: [] })).toBe('Untitled.md');
  });

  it('numbers the name when Untitled.md is taken', () => {
    expect(
      getNewDocumentName({ namesInDirectory: ['Untitled.md', 'notes.md'] })
    ).toBe('Untitled 2.md');
  });

  it('takes the first free number', () => {
    expect(
      getNewDocumentName({
        namesInDirectory: ['Untitled.md', 'Untitled 2.md', 'Untitled 4.md'],
      })
    ).toBe('Untitled 3.md');
  });

  it('treats names that differ only in case as taken', () => {
    expect(getNewDocumentName({ namesInDirectory: ['untitled.MD'] })).toBe(
      'Untitled 2.md'
    );
  });

  it('ignores names with another extension', () => {
    expect(
      getNewDocumentName({ namesInDirectory: ['Untitled', 'Untitled.yaml'] })
    ).toBe('Untitled.md');
  });
});
