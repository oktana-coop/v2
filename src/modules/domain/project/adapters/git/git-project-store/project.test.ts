import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';

import { parseEmail, parseUsername } from '../../../../../../modules/auth';
import { DEFAULT_AUTHOR } from '../../../../../infrastructure/version-control';
import { INITIAL_SNAPSHOT_COMMIT_MESSAGE } from './project';
import { buildTestStore, PROJECT_PATH } from './test-utils';

// The git-lib functions are mocked so these tests cover the store's decisions
// (init, gitignore, snapshot) rather than version-control module internals.
const {
  mockRepositoryExists,
  mockWriteGitignoreIfMissing,
  mockStageAndCommitWorkdirChanges,
  mockCloneRepository,
  mockSetUserInfo,
} = vi.hoisted(() => ({
  mockRepositoryExists: vi.fn(),
  mockWriteGitignoreIfMissing: vi.fn(),
  mockStageAndCommitWorkdirChanges: vi.fn(),
  mockCloneRepository: vi.fn(),
  mockSetUserInfo: vi.fn(),
}));

vi.mock(
  '../../../../../../modules/infrastructure/version-control',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../../../modules/infrastructure/version-control')
      >();

    return {
      ...actual,
      repositoryExists: mockRepositoryExists,
      writeGitignoreIfMissing: mockWriteGitignoreIfMissing,
      stageAndCommitWorkdirChanges: mockStageAndCommitWorkdirChanges,
      cloneRepository: mockCloneRepository,
      setUserInfo: mockSetUserInfo,
    };
  }
);

vi.mock('isomorphic-git', () => ({
  default: {
    init: vi.fn(),
  },
}));

const mockInit = vi.mocked(git.init);

const store = buildTestStore();

const commitOid = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';

const createProject = (
  args: Partial<Parameters<typeof store.createProject>[0]> = {}
) =>
  store.createProject({
    path: PROJECT_PATH,
    username: parseUsername('Alice'),
    email: parseEmail('alice@example.com'),
    ...args,
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockInit.mockResolvedValue(undefined);
  mockWriteGitignoreIfMissing.mockReturnValue(Effect.void);
  mockStageAndCommitWorkdirChanges.mockReturnValue(Effect.succeed(commitOid));
  mockCloneRepository.mockReturnValue(Effect.void);
  mockSetUserInfo.mockReturnValue(Effect.void);
});

describe('createProject', () => {
  describe('when the folder is not a git repository yet', () => {
    beforeEach(() => {
      mockRepositoryExists.mockReturnValue(Effect.succeed(false));
    });

    it('initializes the repo, adds a gitignore and commits a snapshot', async () => {
      const projectId = await Effect.runPromise(createProject());

      expect(projectId).toBe(PROJECT_PATH);
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({ dir: PROJECT_PATH })
      );
      expect(mockWriteGitignoreIfMissing).toHaveBeenCalledWith(
        expect.objectContaining({ dir: PROJECT_PATH })
      );
      expect(mockStageAndCommitWorkdirChanges).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: PROJECT_PATH,
          message: INITIAL_SNAPSHOT_COMMIT_MESSAGE,
        })
      );
    });

    it('attributes the snapshot to the default author', async () => {
      await Effect.runPromise(createProject());

      expect(mockStageAndCommitWorkdirChanges).toHaveBeenCalledWith(
        expect.objectContaining({
          author: DEFAULT_AUTHOR,
        })
      );
    });

    it('snapshots the folder only after the gitignore is in place', async () => {
      await Effect.runPromise(createProject());

      const gitignoreOrder =
        mockWriteGitignoreIfMissing.mock.invocationCallOrder[0];
      const commitOrder =
        mockStageAndCommitWorkdirChanges.mock.invocationCallOrder[0];
      expect(gitignoreOrder).toBeLessThan(commitOrder);
    });

    it('fails without committing when the gitignore cannot be written', async () => {
      mockWriteGitignoreIfMissing.mockReturnValue(
        Effect.fail(new Error('write failed'))
      );

      await Effect.runPromise(Effect.flip(createProject()));

      expect(mockStageAndCommitWorkdirChanges).not.toHaveBeenCalled();
    });
  });

  describe('when the folder is already a git repository', () => {
    beforeEach(() => {
      mockRepositoryExists.mockReturnValue(Effect.succeed(true));
    });

    it('leaves the existing repo untouched', async () => {
      const projectId = await Effect.runPromise(createProject());

      expect(projectId).toBe(PROJECT_PATH);
      expect(mockInit).not.toHaveBeenCalled();
      expect(mockWriteGitignoreIfMissing).not.toHaveBeenCalled();
      expect(mockStageAndCommitWorkdirChanges).not.toHaveBeenCalled();
    });

    it('still records the author info', async () => {
      await Effect.runPromise(createProject());

      expect(mockSetUserInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: PROJECT_PATH,
          username: 'Alice',
          email: 'alice@example.com',
        })
      );
    });
  });

  describe('when cloning', () => {
    it('does not snapshot the cloned repo, which has its own history', async () => {
      await Effect.runPromise(
        createProject({
          cloneUrl: 'https://example.com/repo.git',
          authToken: 'token',
        })
      );

      expect(mockCloneRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: PROJECT_PATH,
          url: 'https://example.com/repo.git',
        })
      );
      expect(mockRepositoryExists).not.toHaveBeenCalled();
      expect(mockInit).not.toHaveBeenCalled();
      expect(mockStageAndCommitWorkdirChanges).not.toHaveBeenCalled();
    });
  });
});
