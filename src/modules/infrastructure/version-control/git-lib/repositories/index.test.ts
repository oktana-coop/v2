import * as Effect from 'effect/Effect';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';
import path from 'path';

import { repositoryExists } from './index';

const dir = '/test-repo';
const mockStat = vi.fn();
const mockFs = { promises: { stat: mockStat } } as unknown as IsoGitFsApi;

const fsError = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('repositoryExists', () => {
  // Whatever `.git` turns out to be — a directory, or a file in a worktree or
  // submodule — the folder is a repository.
  it('is true when the folder has a .git entry', async () => {
    mockStat.mockResolvedValue({});

    const result = await Effect.runPromise(
      repositoryExists({ isoGitFs: mockFs, dir })
    );

    expect(result).toBe(true);
    expect(mockStat).toHaveBeenCalledWith(path.join(dir, '.git'));
  });

  it('is false when .git is missing', async () => {
    mockStat.mockRejectedValue(fsError('ENOENT'));

    const result = await Effect.runPromise(
      repositoryExists({ isoGitFs: mockFs, dir })
    );

    expect(result).toBe(false);
  });

  // An unreadable folder is not the same as one without a repo — reporting it
  // as absent would have the caller initialize a repo over the top of it.
  it('fails when the folder cannot be read', async () => {
    mockStat.mockRejectedValue(fsError('EACCES'));

    const error = await Effect.runPromise(
      Effect.flip(repositoryExists({ isoGitFs: mockFs, dir }))
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });
});
