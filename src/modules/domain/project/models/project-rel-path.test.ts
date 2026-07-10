import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { VersionedProjectValidationErrorTag } from '../errors';
import {
  isPathInsideDirectory,
  parseProjectRelPath,
  parseProjectRelPathEffect,
  safeParseProjectRelPath,
} from './project-rel-path';

describe('projectRelPathSchema', () => {
  it('accepts a normal POSIX path', () => {
    expect(parseProjectRelPath('assets/foo.png')).toBe('assets/foo.png');
  });

  it('normalizes backslashes to slashes', () => {
    expect(parseProjectRelPath('assets\\sub\\foo.png')).toBe(
      'assets/sub/foo.png'
    );
  });

  it('rejects empty strings', () => {
    expect(safeParseProjectRelPath('').success).toBe(false);
  });

  it('rejects paths with a leading slash', () => {
    expect(safeParseProjectRelPath('/assets/foo.png').success).toBe(false);
  });

  it('rejects paths containing a ".." segment', () => {
    expect(safeParseProjectRelPath('../assets/foo.png').success).toBe(false);
    expect(safeParseProjectRelPath('assets/../foo.png').success).toBe(false);
  });
});

describe('parseProjectRelPathEffect', () => {
  it('succeeds with the branded path for valid input', () => {
    const result = Effect.runSync(
      Effect.either(parseProjectRelPathEffect('assets/foo.png'))
    );
    expect(result._tag).toBe('Right');
    if (result._tag === 'Right') {
      expect(result.right).toBe('assets/foo.png');
    }
  });

  it('normalizes backslashes on success', () => {
    const result = Effect.runSync(
      Effect.either(parseProjectRelPathEffect('assets\\sub\\foo.png'))
    );
    expect(result._tag).toBe('Right');
    if (result._tag === 'Right') {
      expect(result.right).toBe('assets/sub/foo.png');
    }
  });

  it('fails with ValidationError for invalid input', () => {
    const result = Effect.runSync(
      Effect.either(parseProjectRelPathEffect('../escape.png'))
    );
    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe(VersionedProjectValidationErrorTag);
    }
  });

  it('fails with ValidationError for empty input', () => {
    const result = Effect.runSync(Effect.either(parseProjectRelPathEffect('')));
    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe(VersionedProjectValidationErrorTag);
    }
  });
});

describe('isPathInsideDirectory', () => {
  const inside = (directoryPath: string, filePath: string) =>
    isPathInsideDirectory({
      directoryPath: parseProjectRelPath(directoryPath),
      filePath: parseProjectRelPath(filePath),
    });

  it('is true for a file directly inside the directory', () => {
    expect(inside('docs', 'docs/guide.md')).toBe(true);
  });

  it('is true for a deeply nested file', () => {
    expect(inside('docs', 'docs/2024/notes.md')).toBe(true);
  });

  it('is true when the path is the directory itself', () => {
    expect(inside('docs', 'docs')).toBe(true);
  });

  it('is false for a sibling directory sharing a name prefix', () => {
    expect(inside('notes', 'notes-2024/entry.md')).toBe(false);
  });

  it('is false for a file outside the directory', () => {
    expect(inside('docs', 'assets/logo.png')).toBe(false);
  });

  it('is false for a project root file checked against a subdirectory', () => {
    expect(inside('docs', 'readme.md')).toBe(false);
  });

  it('is false for a root file whose name shares a prefix with the directory', () => {
    expect(inside('docs', 'docs.md')).toBe(false);
  });
});
