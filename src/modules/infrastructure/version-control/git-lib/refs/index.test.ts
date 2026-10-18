import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import { RepositoryError } from '../../errors';
import { getCommitForRef, isRefCheckedOut } from './index';

vi.mock('isomorphic-git', () => ({
  default: {
    currentBranch: vi.fn(),
    resolveRef: vi.fn(),
  },
}));

const mockFs = {} as IsoGitFsApi;
const dir = '/test-repo';
const headCommit = 'c0ffee1234567890c0ffee1234567890c0ffee12';
const mockCurrentBranch = vi.mocked(git.currentBranch);
const mockResolveRef = vi.mocked(git.resolveRef);

beforeEach(() => {
  vi.clearAllMocks();
  mockCurrentBranch.mockResolvedValue('main');
  mockResolveRef.mockResolvedValue(headCommit);
});

describe('getCommitForRef', () => {
  it('resolves the ref to its commit', async () => {
    const commit = await Effect.runPromise(
      getCommitForRef({ isoGitFs: mockFs, dir, ref: 'HEAD' })
    );

    expect(commit).toBe(headCommit);
    expect(mockResolveRef).toHaveBeenCalledWith({
      fs: mockFs,
      dir,
      ref: 'HEAD',
    });
  });

  it('fails with a repository error when the ref cannot be resolved', async () => {
    mockResolveRef.mockRejectedValue(new Error('no such ref'));

    const failure = await Effect.runPromise(
      Effect.flip(getCommitForRef({ isoGitFs: mockFs, dir, ref: 'nowhere' }))
    );

    expect(failure).toBeInstanceOf(RepositoryError);
  });
});

describe('isRefCheckedOut', () => {
  const checkedOut = (ref: string, refType: 'commit' | 'branch-or-tag') =>
    Effect.runPromise(isRefCheckedOut({ isoGitFs: mockFs, dir, ref, refType }));

  it('holds for the current branch', async () => {
    const result = await checkedOut('main', 'branch-or-tag');

    expect(result).toBe(true);
  });

  it('does not hold for another branch', async () => {
    const result = await checkedOut('draft', 'branch-or-tag');

    expect(result).toBe(false);
  });

  it('does not hold for a branch while HEAD is detached', async () => {
    mockCurrentBranch.mockResolvedValue(undefined);

    const result = await checkedOut('main', 'branch-or-tag');

    expect(result).toBe(false);
  });

  it('holds for the commit HEAD resolves to, given by a prefix', async () => {
    const result = await checkedOut(headCommit.slice(0, 8), 'commit');

    expect(result).toBe(true);
    expect(mockResolveRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'HEAD' })
    );
  });

  it('holds for the commit a detached HEAD is at', async () => {
    mockCurrentBranch.mockResolvedValue(undefined);

    const result = await checkedOut(headCommit, 'commit');

    expect(result).toBe(true);
  });

  it('does not hold for another commit', async () => {
    const result = await checkedOut('4a1d2e3f', 'commit');

    expect(result).toBe(false);
  });
});
