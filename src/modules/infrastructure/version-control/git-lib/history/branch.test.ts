import * as Effect from 'effect/Effect';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import { type Branch } from '../../models';
import { getBranchCommitHistory } from './branch';

vi.mock('isomorphic-git', () => ({
  default: {
    log: vi.fn(),
  },
  Errors: {
    NotFoundError: class NotFoundError extends Error {},
  },
}));

const mockFs = {} as IsoGitFsApi;
const dir = '/test-repo';
const mockLog = vi.mocked(git.log);

const makeLogEntry = (
  oid: string,
  message: string,
  timestamp: number,
  authorName = 'Test'
) =>
  ({
    oid,
    payload: '',
    commit: {
      message,
      author: { name: authorName, timestamp },
      parent: [] as string[],
    },
  }) as Awaited<ReturnType<typeof git.log>>[number];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getBranchCommitHistory', () => {
  const branch = 'main' as Branch;

  it('returns commits for the given branch', async () => {
    mockLog.mockResolvedValue([
      makeLogEntry('aabbccdd', 'second commit', 1735732800),
      makeLogEntry('11223344', 'first commit', 1735689600),
    ]);

    const result = await Effect.runPromise(
      getBranchCommitHistory({ isoGitFs: mockFs, dir, branch })
    );

    expect(result).toHaveLength(2);
    expect(result[0].message).toBe('second commit');
    expect(result[1].message).toBe('first commit');
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ ref: branch })
    );
  });

  it('passes limit as depth to git.log', async () => {
    mockLog.mockResolvedValue([makeLogEntry('aabbccdd', 'latest', 1735732800)]);

    await Effect.runPromise(
      getBranchCommitHistory({ isoGitFs: mockFs, dir, branch, limit: 1 })
    );

    expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({ depth: 1 }));
  });

  it('returns empty array when branch has no commits', async () => {
    mockLog.mockRejectedValue(new IsoGitErrors.NotFoundError('not found'));

    const result = await Effect.runPromise(
      getBranchCommitHistory({ isoGitFs: mockFs, dir, branch })
    );

    expect(result).toEqual([]);
  });

  it('fails with RepositoryError for other git errors', async () => {
    mockLog.mockRejectedValue(new Error('disk failure'));

    const error = await Effect.runPromise(
      Effect.flip(getBranchCommitHistory({ isoGitFs: mockFs, dir, branch }))
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });
});
