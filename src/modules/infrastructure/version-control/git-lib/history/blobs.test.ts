import * as Effect from 'effect/Effect';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import { readBlobAtCommit } from './blobs';

vi.mock('isomorphic-git', () => ({
  default: {
    readBlob: vi.fn(),
  },
  Errors: {
    NotFoundError: class NotFoundError extends Error {},
  },
}));

const mockFs = {} as IsoGitFsApi;
const dir = '/test-repo';
const mockReadBlob = vi.mocked(git.readBlob);

const commitHash = 'abc123' as Parameters<
  typeof readBlobAtCommit
>[0]['commitHash'];

describe('readBlobAtCommit', () => {
  it('succeeds with the blob bytes when the file exists at the commit', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    mockReadBlob.mockResolvedValue({ oid: 'aaa', blob: bytes });

    const result = await Effect.runPromise(
      readBlobAtCommit({
        isoGitFs: mockFs,
        dir,
        commitHash,
        filepath: 'doc.md',
      })
    );

    expect(result).toBe(bytes);
    expect(mockReadBlob).toHaveBeenCalledWith({
      fs: mockFs,
      dir,
      oid: commitHash,
      filepath: 'doc.md',
    });
  });

  it('fails with NotFoundError when the file is absent at the commit', async () => {
    mockReadBlob.mockRejectedValue(
      new IsoGitErrors.NotFoundError('File not found')
    );

    const error = await Effect.runPromise(
      Effect.flip(
        readBlobAtCommit({
          isoGitFs: mockFs,
          dir,
          commitHash,
          filepath: 'missing.md',
        })
      )
    );

    expect(error._tag).toBe('VersionControlNotFoundError');
  });

  it('fails with RepositoryError for other git errors', async () => {
    mockReadBlob.mockRejectedValue(new Error('Git error'));

    const error = await Effect.runPromise(
      Effect.flip(
        readBlobAtCommit({
          isoGitFs: mockFs,
          dir,
          commitHash,
          filepath: 'doc.md',
        })
      )
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });
});
