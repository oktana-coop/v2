import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import { type Branch } from '../../models';
import { DEFAULT_AUTHOR } from '../committing';
import { mergeAndDeleteBranch } from './index';

vi.mock('isomorphic-git', () => ({
  default: {
    checkout: vi.fn(),
    merge: vi.fn(),
    getConfig: vi.fn(),
    currentBranch: vi.fn(),
    deleteBranch: vi.fn(),
  },
  Errors: {
    MergeConflictError: class MergeConflictError extends Error {
      data = {};
    },
  },
}));

vi.mock('isomorphic-git/managers', () => ({
  GitIndexManager: { acquire: vi.fn() },
}));

const mockFs = {} as IsoGitFsApi;
const dir = '/test-repo';
const mockCheckout = vi.mocked(git.checkout);
const mockMerge = vi.mocked(git.merge);
const mockGetConfig = vi.mocked(git.getConfig);
const mockCurrentBranch = vi.mocked(git.currentBranch);
const mockDeleteBranch = vi.mocked(git.deleteBranch);

const from = 'feature' as Branch;
const into = 'main' as Branch;
const mergeCommitOid = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';

const stubAuthorConfig = (username = 'Alice', email = 'alice@example.com') => {
  mockGetConfig.mockImplementation(async ({ path }) =>
    path === 'user.name' ? username : path === 'user.email' ? email : undefined
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckout.mockResolvedValue(undefined);
  mockMerge.mockResolvedValue({ oid: mergeCommitOid });
  mockCurrentBranch.mockResolvedValue(into);
  mockDeleteBranch.mockResolvedValue(undefined);
});

describe('mergeAndDeleteBranch', () => {
  describe('with author config', () => {
    beforeEach(() => {
      stubAuthorConfig();
    });

    it('attributes the merge commit to the configured user', async () => {
      const result = await Effect.runPromise(
        mergeAndDeleteBranch({ isoGitFs: mockFs, dir, from, into })
      );

      expect(result).toBe(mergeCommitOid);
      expect(mockMerge).toHaveBeenCalledWith(
        expect.objectContaining({
          fs: mockFs,
          dir,
          ours: into,
          theirs: from,
          author: { name: 'Alice', email: 'alice@example.com' },
        })
      );
    });

    it('deletes the source branch after merging', async () => {
      await Effect.runPromise(
        mergeAndDeleteBranch({ isoGitFs: mockFs, dir, from, into })
      );

      expect(mockDeleteBranch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: from })
      );
      const mergeOrder = mockMerge.mock.invocationCallOrder[0];
      const deleteOrder = mockDeleteBranch.mock.invocationCallOrder[0];
      expect(mergeOrder).toBeLessThan(deleteOrder);
    });
  });

  describe('without author config', () => {
    it('falls back to the default author', async () => {
      // user.name and user.email both unset → falls back to defaults.
      mockGetConfig.mockResolvedValue(undefined);

      await Effect.runPromise(
        mergeAndDeleteBranch({ isoGitFs: mockFs, dir, from, into })
      );

      expect(mockMerge).toHaveBeenCalledWith(
        expect.objectContaining({
          author: DEFAULT_AUTHOR,
        })
      );
    });
  });
});
