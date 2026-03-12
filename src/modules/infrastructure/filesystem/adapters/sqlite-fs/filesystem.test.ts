import * as Effect from 'effect/Effect';

import {
  AlreadyExistsError,
  NotFoundError,
  RepositoryError,
} from '../../errors';
import { createAdapter } from './filesystem';
import { type NodeLikeFsApi } from './node-like-sqlite-fs';

// getRenamedPath is pure and doesn't touch the fs, so we only need
// a real fs mock for renameFile tests.
const makeFs = (overrides: Partial<NodeLikeFsApi> = {}): NodeLikeFsApi =>
  ({ ...overrides }) as NodeLikeFsApi;

describe('sqlite-fs filesystem adapter', () => {
  // The SQLite filesystem always uses POSIX paths regardless of host OS.
  const basePath = '/home/alice/documents';

  describe('getRenamedPath', () => {
    const adapter = createAdapter(makeFs());

    it('preserves extension when renaming a file in a directory', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({
          oldPath: `${basePath}/notes.md`,
          newName: 'renamed',
        })
      );

      expect(result).toBe(`${basePath}/renamed.md`);
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
          oldPath: `${basePath}/docs/intro.md`,
          newName: 'getting-started',
        })
      );

      expect(result).toBe(`${basePath}/docs/getting-started.md`);
    });

    it('preserves a file with no extension', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({
          oldPath: `${basePath}/LICENSE`,
          newName: 'NOTICE',
        })
      );

      expect(result).toBe(`${basePath}/NOTICE`);
    });
  });

  describe('renameFile', () => {
    const mockNodeError = (code: string) =>
      Object.assign(new Error(code), { code });

    const oldPath = `${basePath}/notes.md`;
    const newPath = `${basePath}/renamed.md`;

    it('renames the file successfully', async () => {
      const rename = jest.fn().mockResolvedValue(undefined);
      const adapter = createAdapter(makeFs({ rename }));

      await Effect.runPromise(adapter.renameFile({ oldPath, newPath }));

      expect(rename).toHaveBeenCalledWith(oldPath, newPath);
    });

    it('fails with AlreadyExistsError when the target already exists', async () => {
      const rename = jest.fn().mockRejectedValue(mockNodeError('EEXIST'));
      const adapter = createAdapter(makeFs({ rename }));

      // Effect.flip swaps the error and success channels, letting us
      // assert on the failure value via runPromise
      const err = await Effect.runPromise(
        Effect.flip(adapter.renameFile({ oldPath, newPath }))
      );

      expect(err).toBeInstanceOf(AlreadyExistsError);
    });

    it('fails with NotFoundError when the source file does not exist', async () => {
      const rename = jest.fn().mockRejectedValue(mockNodeError('ENOENT'));
      const adapter = createAdapter(makeFs({ rename }));

      const err = await Effect.runPromise(
        Effect.flip(adapter.renameFile({ oldPath, newPath }))
      );

      expect(err).toBeInstanceOf(NotFoundError);
    });

    it('fails with RepositoryError for other Node.js errors', async () => {
      const rename = jest.fn().mockRejectedValue(mockNodeError('EIO'));
      const adapter = createAdapter(makeFs({ rename }));

      const err = await Effect.runPromise(
        Effect.flip(adapter.renameFile({ oldPath, newPath }))
      );

      expect(err).toBeInstanceOf(RepositoryError);
    });

    it('fails with RepositoryError for non-Node.js errors', async () => {
      const rename = jest.fn().mockRejectedValue(new TypeError('unexpected'));
      const adapter = createAdapter(makeFs({ rename }));

      const err = await Effect.runPromise(
        Effect.flip(adapter.renameFile({ oldPath, newPath }))
      );

      expect(err).toBeInstanceOf(RepositoryError);
    });
  });
});
