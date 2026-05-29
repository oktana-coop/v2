import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { VersionedProjectValidationErrorTag } from '../errors';
import {
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
