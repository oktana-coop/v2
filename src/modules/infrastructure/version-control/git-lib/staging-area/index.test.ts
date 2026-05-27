import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  hasStagedChanges,
  removeFile,
  stageFile,
  stageFiles,
  stageWorkdirChanges,
} from './index';

vi.mock('isomorphic-git', () => ({
  default: {
    add: vi.fn(),
    remove: vi.fn(),
    statusMatrix: vi.fn(),
  },
}));

const mockFs = {} as IsoGitFsApi;
const dir = '/test-repo';
const mockAdd = vi.mocked(git.add);
const mockRemove = vi.mocked(git.remove);
const mockStatusMatrix = vi.mocked(git.statusMatrix);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hasStagedChanges', () => {
  // statusMatrix tuples are [filepath, HEAD, WORKDIR, STAGE]. A file is
  // "staged" when HEAD !== STAGE (index 0 vs index 2 differ).
  it('returns true when at least one file has staged changes', async () => {
    mockStatusMatrix.mockResolvedValue([
      ['unchanged.md', 1, 1, 1],
      ['staged.md', 0, 1, 2], // HEAD (0) !== STAGE (2) → staged
    ]);

    const result = await Effect.runPromise(
      hasStagedChanges({ isoGitFs: mockFs, dir })
    );

    expect(result).toBe(true);
  });

  it('returns false when no files have staged changes', async () => {
    mockStatusMatrix.mockResolvedValue([
      ['a.md', 1, 1, 1],
      ['b.md', 1, 2, 1], // modified in workdir but NOT staged → not staged
    ]);

    const result = await Effect.runPromise(
      hasStagedChanges({ isoGitFs: mockFs, dir })
    );

    expect(result).toBe(false);
  });

  it('fails with RepositoryError when statusMatrix throws', async () => {
    mockStatusMatrix.mockRejectedValue(new Error('disk error'));

    const error = await Effect.runPromise(
      Effect.flip(hasStagedChanges({ isoGitFs: mockFs, dir }))
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });
});

describe('stageFile', () => {
  it('calls git.add with the given path', async () => {
    mockAdd.mockResolvedValue(undefined);

    await Effect.runPromise(
      stageFile({ isoGitFs: mockFs, dir, path: 'doc.md' })
    );

    expect(mockAdd).toHaveBeenCalledWith({
      fs: mockFs,
      dir,
      filepath: 'doc.md',
    });
  });

  it('fails with RepositoryError when git.add throws', async () => {
    mockAdd.mockRejectedValue(new Error('add failed'));

    const error = await Effect.runPromise(
      Effect.flip(stageFile({ isoGitFs: mockFs, dir, path: 'doc.md' }))
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });
});

describe('stageFiles', () => {
  it('calls git.add once with the paths as an array', async () => {
    mockAdd.mockResolvedValue(undefined);

    await Effect.runPromise(
      stageFiles({ isoGitFs: mockFs, dir, paths: ['a.md', 'b.md'] })
    );

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith({
      fs: mockFs,
      dir,
      filepath: ['a.md', 'b.md'],
    });
  });

  it('fails with RepositoryError when git.add throws', async () => {
    mockAdd.mockRejectedValue(new Error('add failed'));

    const error = await Effect.runPromise(
      Effect.flip(
        stageFiles({ isoGitFs: mockFs, dir, paths: ['a.md', 'b.md'] })
      )
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });
});

describe('stageWorkdirChanges', () => {
  it('calls git.add with filepath "."', async () => {
    mockAdd.mockResolvedValue(undefined);

    await Effect.runPromise(stageWorkdirChanges({ isoGitFs: mockFs, dir }));

    expect(mockAdd).toHaveBeenCalledWith({
      fs: mockFs,
      dir,
      filepath: '.',
    });
  });

  it('fails with RepositoryError when git.add throws', async () => {
    mockAdd.mockRejectedValue(new Error('add failed'));

    const error = await Effect.runPromise(
      Effect.flip(stageWorkdirChanges({ isoGitFs: mockFs, dir }))
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });
});

describe('removeFile', () => {
  it('calls git.remove with the given path', async () => {
    mockRemove.mockResolvedValue(undefined);

    await Effect.runPromise(
      removeFile({ isoGitFs: mockFs, dir, path: 'doc.md' })
    );

    expect(mockRemove).toHaveBeenCalledWith({
      fs: mockFs,
      dir,
      filepath: 'doc.md',
    });
  });

  it('fails with RepositoryError when git.remove throws', async () => {
    mockRemove.mockRejectedValue(new Error('remove failed'));

    const error = await Effect.runPromise(
      Effect.flip(removeFile({ isoGitFs: mockFs, dir, path: 'doc.md' }))
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });
});
