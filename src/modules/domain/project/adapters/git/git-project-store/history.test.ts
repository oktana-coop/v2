import * as Effect from 'effect/Effect';

import { type Username } from '../../../../../auth';
import {
  type Branch,
  type ChangedDocument,
  type ChangeId,
  type Commit,
  type CommitId,
  NotFoundError as VersionControlNotFoundError,
  RepositoryError as VersionControlRepositoryError,
  UNCOMMITTED_CHANGE_ID,
} from '../../../../../infrastructure/version-control';
import {
  VersionedProjectNotFoundErrorTag,
  VersionedProjectRepositoryErrorTag,
  VersionedProjectValidationErrorTag,
} from '../../../errors';
import { buildTestStore, PROJECT_PATH } from './test-utils';

// We mock the git-lib functions so that these tests focus on store behavior, not version-control module internals.
// vi.hoisted ensures these are available when the hoisted vi.mock factory runs.
const {
  mockGetBranchCommitHistory,
  mockGetChangedFilesForCommit,
  mockGetUncommittedFileChanges,
} = vi.hoisted(() => ({
  mockGetBranchCommitHistory: vi.fn(),
  mockGetChangedFilesForCommit: vi.fn(),
  mockGetUncommittedFileChanges: vi.fn(),
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
      getBranchCommitHistory: mockGetBranchCommitHistory,
      getChangedFilesForCommit: mockGetChangedFilesForCommit,
      getUncommittedFileChanges: mockGetUncommittedFileChanges,
    };
  }
);

vi.mock('isomorphic-git', () => ({
  default: {
    init: vi.fn(),
    commit: vi.fn(),
    add: vi.fn(),
    status: vi.fn(),
    log: vi.fn(),
    readBlob: vi.fn(),
    readCommit: vi.fn(),
    resolveRef: vi.fn(),
    currentBranch: vi.fn(),
    statusMatrix: vi.fn(),
    getConfig: vi.fn(),
    hashBlob: vi.fn(),
  },
  Errors: {
    NotFoundError: class NotFoundError extends Error {},
  },
}));

const store = buildTestStore();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('history', () => {
  describe('getProjectCommitHistory', () => {
    const branch = 'main';

    it('returns the commit history for the given branch', async () => {
      const mockCommits: Commit[] = [
        {
          id: 'cccccccc' as CommitId,
          message: 'third commit',
          time: new Date('2025-03-03'),
          author: { username: 'Test' as Username },
        },
        {
          id: 'bbbbbbbb' as CommitId,
          message: 'second commit',
          time: new Date('2025-03-02'),
          author: { username: 'Test' as Username },
        },
        {
          id: 'aaaaaaaa' as CommitId,
          message: 'initial commit',
          time: new Date('2025-03-01'),
          author: { username: 'Test' as Username },
        },
      ];

      mockGetBranchCommitHistory.mockReturnValue(Effect.succeed(mockCommits));

      const result = await Effect.runPromise(
        store.getProjectCommitHistory({
          projectId: PROJECT_PATH,
          branch: branch as Branch,
        })
      );

      expect(result).toEqual(mockCommits);
      expect(result).toHaveLength(3);
      expect(mockGetBranchCommitHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: PROJECT_PATH,
          branch,
        })
      );
    });

    it('returns an empty list when the branch has no commits', async () => {
      mockGetBranchCommitHistory.mockReturnValue(Effect.succeed([]));

      const result = await Effect.runPromise(
        store.getProjectCommitHistory({
          projectId: PROJECT_PATH,
          branch: branch as Branch,
        })
      );

      expect(result).toEqual([]);
    });

    it('passes limit parameter through', async () => {
      mockGetBranchCommitHistory.mockReturnValue(Effect.succeed([]));

      await Effect.runPromise(
        store.getProjectCommitHistory({
          projectId: PROJECT_PATH,
          branch: branch as Branch,
          limit: 10,
        })
      );

      expect(mockGetBranchCommitHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });

    it('maps VersionControlNotFoundError to project NotFoundError', async () => {
      mockGetBranchCommitHistory.mockReturnValue(
        Effect.fail(new VersionControlNotFoundError('branch not found'))
      );

      const error = await Effect.runPromise(
        store
          .getProjectCommitHistory({
            projectId: PROJECT_PATH,
            branch: 'nonexistent' as Branch,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectNotFoundErrorTag);
    });

    it('maps VersionControlRepositoryError to project RepositoryError', async () => {
      mockGetBranchCommitHistory.mockReturnValue(
        Effect.fail(new VersionControlRepositoryError('repo error'))
      );

      const error = await Effect.runPromise(
        store
          .getProjectCommitHistory({
            projectId: PROJECT_PATH,
            branch: branch as Branch,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });
  });

  describe('getChangedDocumentsAtChange', () => {
    const commitHash = 'aabbccdd';

    it('returns changed files for a given commit', async () => {
      const mockChanges: ChangedDocument[] = [
        { path: 'doc.md', changeType: 'ADDED' },
        { path: 'readme.md', changeType: 'MODIFIED' },
        { path: 'old-notes.md', changeType: 'DELETED' },
        {
          path: 'guide.md',
          changeType: 'RENAMED',
          previousPath: 'tutorial.md',
        },
      ];

      mockGetChangedFilesForCommit.mockReturnValue(Effect.succeed(mockChanges));

      const result = await Effect.runPromise(
        store.getChangedDocumentsAtChange({
          projectId: PROJECT_PATH,
          changeId: commitHash as ChangeId,
        })
      );

      expect(result).toEqual(mockChanges);
      expect(result).toHaveLength(4);
      expect(mockGetChangedFilesForCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: PROJECT_PATH,
          commitId: commitHash,
        })
      );
    });

    it('returns uncommitted file changes when changeId is uncommitted', async () => {
      const mockChanges: ChangedDocument[] = [
        { path: 'doc.md', changeType: 'MODIFIED' },
        { path: 'draft.md', changeType: 'ADDED' },
      ];

      mockGetUncommittedFileChanges.mockReturnValue(
        Effect.succeed(mockChanges)
      );

      const result = await Effect.runPromise(
        store.getChangedDocumentsAtChange({
          projectId: PROJECT_PATH,
          changeId: UNCOMMITTED_CHANGE_ID,
        })
      );

      expect(result).toEqual(mockChanges);
      expect(mockGetUncommittedFileChanges).toHaveBeenCalledWith(
        expect.objectContaining({ dir: PROJECT_PATH })
      );
      expect(mockGetChangedFilesForCommit).not.toHaveBeenCalled();
    });

    it('maps VersionControlRepositoryError from getUncommittedFileChanges', async () => {
      mockGetUncommittedFileChanges.mockReturnValue(
        Effect.fail(new VersionControlRepositoryError('status error'))
      );

      const error = await Effect.runPromise(
        store
          .getChangedDocumentsAtChange({
            projectId: PROJECT_PATH,
            changeId: UNCOMMITTED_CHANGE_ID,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });

    it('fails with ValidationError for invalid changeId', async () => {
      const error = await Effect.runPromise(
        store
          .getChangedDocumentsAtChange({
            projectId: PROJECT_PATH,
            changeId: 'not-valid!' as ChangeId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectValidationErrorTag);
    });

    it('maps VersionControlRepositoryError to project RepositoryError', async () => {
      mockGetChangedFilesForCommit.mockReturnValue(
        Effect.fail(new VersionControlRepositoryError('repo error'))
      );

      const error = await Effect.runPromise(
        store
          .getChangedDocumentsAtChange({
            projectId: PROJECT_PATH,
            changeId: commitHash as ChangeId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });
  });
});
