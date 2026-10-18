import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import { BranchSwitchConflictError, RepositoryError } from '../../errors';
import { type Branch } from '../../models';
import { switchToBranch } from './index';

vi.mock('isomorphic-git', () => ({
  default: {
    checkout: vi.fn(),
  },
}));

const mockFs = {} as IsoGitFsApi;
const dir = '/test-repo';
const branch = 'feature' as Branch;
const mockCheckout = vi.mocked(git.checkout);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('switchToBranch', () => {
  it('checks out the branch', async () => {
    mockCheckout.mockResolvedValue(undefined);

    await Effect.runPromise(switchToBranch({ isoGitFs: mockFs, dir, branch }));

    expect(mockCheckout).toHaveBeenCalledWith({
      fs: mockFs,
      dir,
      ref: branch,
    });
  });

  it('reports the files a checkout conflict would overwrite', async () => {
    mockCheckout.mockRejectedValue(
      Object.assign(new Error('conflict'), {
        code: 'CheckoutConflictError',
        data: { filepaths: ['differs.md', 'feature-only.md'] },
      })
    );

    const failure = await Effect.runPromise(
      Effect.flip(switchToBranch({ isoGitFs: mockFs, dir, branch }))
    );

    expect(failure).toBeInstanceOf(BranchSwitchConflictError);
    expect((failure as BranchSwitchConflictError).data.filepaths).toEqual([
      'differs.md',
      'feature-only.md',
    ]);
  });

  it('fails with a repository error on any other checkout error', async () => {
    mockCheckout.mockRejectedValue(new Error('boom'));

    const failure = await Effect.runPromise(
      Effect.flip(switchToBranch({ isoGitFs: mockFs, dir, branch }))
    );

    expect(failure).toBeInstanceOf(RepositoryError);
  });
});
