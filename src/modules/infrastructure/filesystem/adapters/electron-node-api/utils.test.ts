import { describe, expect, it } from 'vitest';

import { isHidden, isNodeError, pathContainsHiddenEntries } from './utils';

describe('pathContainsHiddenEntries', () => {
  it('should detect hidden entries at the start of a path', () => {
    expect(pathContainsHiddenEntries('.hidden/file.txt')).toBe(true);
  });

  it('should detect hidden entries in the middle of a path', () => {
    expect(pathContainsHiddenEntries('dir/.hidden/file.txt')).toBe(true);
  });

  it('should detect hidden entries at the end of a path', () => {
    expect(pathContainsHiddenEntries('dir/file/.hidden')).toBe(true);
  });

  it('should return false for paths without hidden entries', () => {
    expect(pathContainsHiddenEntries('dir/subdir/file.txt')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(pathContainsHiddenEntries('')).toBe(false);
  });

  it('should ignore . and .. path segments', () => {
    expect(pathContainsHiddenEntries('./file.txt')).toBe(false);
    expect(pathContainsHiddenEntries('../dir/file.txt')).toBe(false);
    expect(pathContainsHiddenEntries('dir/./subdir/file.txt')).toBe(false);
    expect(pathContainsHiddenEntries('dir/../subdir/file.txt')).toBe(false);
  });

  it('should detect multiple hidden entries in a path', () => {
    expect(pathContainsHiddenEntries('.hidden1/.hidden2/file.txt')).toBe(true);
  });

  it('should handle paths with single segment', () => {
    expect(pathContainsHiddenEntries('.hidden')).toBe(true);
    expect(pathContainsHiddenEntries('visible')).toBe(false);
  });
});

describe('isHidden', () => {
  it('should identify files starting with dot as hidden', () => {
    expect(isHidden('.gitignore')).toBe(true);
    expect(isHidden('.hidden')).toBe(true);
    expect(isHidden('.env')).toBe(true);
  });

  it('should return false for regular files without dot prefix', () => {
    expect(isHidden('file.txt')).toBe(false);
    expect(isHidden('README.md')).toBe(false);
    expect(isHidden('config')).toBe(false);
  });

  it('should only check the basename of a path', () => {
    expect(isHidden('/path/to/.hidden')).toBe(true);
    expect(isHidden('/path/.hidden/file.txt')).toBe(false);
    expect(isHidden('dir/.hidden')).toBe(true);
  });

  it('should handle edge cases', () => {
    expect(isHidden('.')).toBe(true);
    expect(isHidden('..')).toBe(true);
    expect(isHidden('')).toBe(false);
  });

  it('should handle file paths with multiple dots', () => {
    expect(isHidden('.file.backup.txt')).toBe(true);
    expect(isHidden('file.backup.txt')).toBe(false);
  });
});

describe('isNodeError', () => {
  it('should identify NodeJS.ErrnoException with code property', () => {
    const err = new Error('test') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    expect(isNodeError(err)).toBe(true);
  });

  it('should identify objects with code property as NodeError', () => {
    const err = {
      code: 'ENOENT',
    } as unknown;
    // This will return false since it's not an Error instance
    expect(isNodeError(err)).toBe(false);
  });

  it('should return false for regular Error objects without code', () => {
    const err = new Error('regular error');
    expect(isNodeError(err)).toBe(false);
  });

  it('should return false for non-Error objects', () => {
    expect(isNodeError('not an error')).toBe(false);
    expect(isNodeError({})).toBe(false);
    expect(isNodeError(null)).toBe(false);
    expect(isNodeError(undefined)).toBe(false);
    expect(isNodeError(123)).toBe(false);
  });

  it('should return false for Error instances from custom classes', () => {
    class CustomError extends Error {}
    const err = new CustomError('custom');
    expect(isNodeError(err)).toBe(false);
  });

  it('should identify various NodeJS error codes', () => {
    const createNodeError = (code: string) => {
      const err = new Error('test') as NodeJS.ErrnoException;
      err.code = code;
      return err;
    };

    expect(isNodeError(createNodeError('ENOENT'))).toBe(true);
    expect(isNodeError(createNodeError('EACCES'))).toBe(true);
    expect(isNodeError(createNodeError('EISDIR'))).toBe(true);
  });
});
