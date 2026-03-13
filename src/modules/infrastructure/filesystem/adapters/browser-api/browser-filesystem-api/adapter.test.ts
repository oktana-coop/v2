import * as Effect from 'effect/Effect';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { createAdapter } from './adapter';

describe('browser-filesystem-api adapter', () => {
  const adapter = createAdapter();
  const basePath =
    process.platform === 'win32'
      ? 'C:\\Users\\alice\\Documents'
      : '/Users/alice/Documents';

  describe('getRenamedPath', () => {
    it('preserves extension when renaming a file in a directory', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({
          oldPath: path.join(basePath, 'notes.md'),
          newName: 'renamed',
        })
      );

      expect(result).toBe(path.join(basePath, 'renamed.md'));
    });

    it('produces no leading dot-slash for a filename without a parent directory', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({ oldPath: 'notes.md', newName: 'renamed' })
      );

      expect(result).toBe('renamed.md');
    });

    it('works for files in subdirectories', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({
          oldPath: path.join(basePath, 'docs', 'intro.md'),
          newName: 'getting-started',
        })
      );

      expect(result).toBe(path.join(basePath, 'docs', 'getting-started.md'));
    });

    it('preserves a file with no extension', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({
          oldPath: path.join(basePath, 'LICENSE'),
          newName: 'NOTICE',
        })
      );

      expect(result).toBe(path.join(basePath, 'NOTICE'));
    });
  });
});
