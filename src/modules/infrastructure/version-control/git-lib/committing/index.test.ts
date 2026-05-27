import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import { DEFAULT_AUTHOR_NAME } from '../../constants';
import {
  commitStagedChanges,
  stageAndCommitChangesToFiles,
  stageAndCommitWorkdirChanges,
} from './index';

vi.mock('isomorphic-git', () => ({
  default: {
    add: vi.fn(),
    commit: vi.fn(),
    getConfig: vi.fn(),
  },
}));

const mockFs = {} as IsoGitFsApi;
const dir = '/test-repo';
const mockAdd = vi.mocked(git.add);
const mockCommit = vi.mocked(git.commit);
const mockGetConfig = vi.mocked(git.getConfig);

const commitOid = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';

const stubAuthorConfig = (username = 'Alice', email = 'alice@example.com') => {
  mockGetConfig.mockImplementation(async ({ path }) =>
    path === 'user.name' ? username : path === 'user.email' ? email : undefined
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('commitStagedChanges', () => {
  describe('with author config', () => {
    beforeEach(() => {
      stubAuthorConfig();
    });

    it('returns the parsed commit hash on success', async () => {
      mockCommit.mockResolvedValue(commitOid);

      const result = await Effect.runPromise(
        commitStagedChanges({ isoGitFs: mockFs, dir, message: 'msg' })
      );

      expect(result).toBe(commitOid);
      expect(mockCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          fs: mockFs,
          dir,
          message: 'msg',
          author: { name: 'Alice', email: 'alice@example.com' },
        })
      );
    });

    it('fails with RepositoryError when git.commit throws', async () => {
      mockCommit.mockRejectedValue(new Error('commit failed'));

      const error = await Effect.runPromise(
        Effect.flip(
          commitStagedChanges({ isoGitFs: mockFs, dir, message: 'msg' })
        )
      );

      expect(error._tag).toBe('VersionControlRepositoryError');
    });
  });

  describe('without author config', () => {
    beforeEach(() => {
      // user.name and user.email both unset → falls back to defaults.
      mockGetConfig.mockResolvedValue(undefined);
    });

    it('uses DEFAULT_AUTHOR_NAME as the commit author', async () => {
      mockCommit.mockResolvedValue(commitOid);

      await Effect.runPromise(
        commitStagedChanges({ isoGitFs: mockFs, dir, message: 'msg' })
      );

      expect(mockCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          author: { name: DEFAULT_AUTHOR_NAME, email: undefined },
        })
      );
    });
  });

  describe('when reading author config fails', () => {
    it('fails with RepositoryError before reaching git.commit', async () => {
      mockGetConfig.mockRejectedValue(new Error('config read failed'));

      const error = await Effect.runPromise(
        Effect.flip(
          commitStagedChanges({ isoGitFs: mockFs, dir, message: 'msg' })
        )
      );

      expect(error._tag).toBe('VersionControlRepositoryError');
      expect(mockCommit).not.toHaveBeenCalled();
    });
  });
});

describe('stageAndCommitWorkdirChanges', () => {
  describe('with author config', () => {
    beforeEach(() => {
      stubAuthorConfig();
    });

    it('stages the whole workdir and commits, in order', async () => {
      mockAdd.mockResolvedValue(undefined);
      mockCommit.mockResolvedValue(commitOid);

      const result = await Effect.runPromise(
        stageAndCommitWorkdirChanges({ isoGitFs: mockFs, dir, message: 'msg' })
      );

      expect(result).toBe(commitOid);
      expect(mockAdd).toHaveBeenCalledWith({
        fs: mockFs,
        dir,
        filepath: '.',
      });
      // Verify add happened before commit by comparing invocation order.
      const addOrder = mockAdd.mock.invocationCallOrder[0];
      const commitOrder = mockCommit.mock.invocationCallOrder[0];
      expect(addOrder).toBeLessThan(commitOrder);
    });
  });

  it('fails with RepositoryError when the staging step fails', async () => {
    mockAdd.mockRejectedValue(new Error('add failed'));

    const error = await Effect.runPromise(
      Effect.flip(
        stageAndCommitWorkdirChanges({ isoGitFs: mockFs, dir, message: 'msg' })
      )
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
    expect(mockCommit).not.toHaveBeenCalled();
  });
});

describe('stageAndCommitChangesToFiles', () => {
  describe('with author config', () => {
    beforeEach(() => {
      stubAuthorConfig();
    });

    it('stages the given paths and commits, in order', async () => {
      mockAdd.mockResolvedValue(undefined);
      mockCommit.mockResolvedValue(commitOid);

      const result = await Effect.runPromise(
        stageAndCommitChangesToFiles({
          isoGitFs: mockFs,
          dir,
          paths: ['a.md', 'assets/img.png'],
          message: 'msg',
        })
      );

      expect(result).toBe(commitOid);
      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockAdd).toHaveBeenCalledWith({
        fs: mockFs,
        dir,
        filepath: ['a.md', 'assets/img.png'],
      });
      const addOrder = mockAdd.mock.invocationCallOrder[0];
      const commitOrder = mockCommit.mock.invocationCallOrder[0];
      expect(addOrder).toBeLessThan(commitOrder);
    });
  });

  it('fails with RepositoryError when the staging step fails', async () => {
    mockAdd.mockRejectedValue(new Error('add failed'));

    const error = await Effect.runPromise(
      Effect.flip(
        stageAndCommitChangesToFiles({
          isoGitFs: mockFs,
          dir,
          paths: ['a.md'],
          message: 'msg',
        })
      )
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
    expect(mockCommit).not.toHaveBeenCalled();
  });
});
