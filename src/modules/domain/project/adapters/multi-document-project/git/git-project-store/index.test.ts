import * as Effect from 'effect/Effect';
import git, {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import { type Username } from '../../../../../../auth';
import { type Filesystem } from '../../../../../../infrastructure/filesystem';
import {
  type Branch,
  type ChangedDocument,
  type ChangeId,
  type Commit,
  type CommitId,
  NotFoundError as VersionControlNotFoundError,
  RepositoryError as VersionControlRepositoryError,
  type ResolvedArtifactId,
  UNCOMMITTED_CHANGE_ID,
} from '../../../../../../infrastructure/version-control';
import {
  VersionedProjectNotFoundErrorTag,
  VersionedProjectRepositoryErrorTag,
  VersionedProjectValidationErrorTag,
} from '../../../../errors';
import { type ProjectId } from '../../../../models';
import { createAdapter } from './index';

// We mock the git-lib functions so that these tests focus on store behavior, not version-control module internals.
// vi.hoisted ensures these are available when the hoisted vi.mock factory runs.
const {
  mockRemoveFile,
  mockHasStagedChanges,
  mockFileExistsAtCommit,
  mockGetBranchCommitHistory,
  mockGetChangedFilesForCommit,
  mockGetUncommittedFileChanges,
  mockGetUserInfo,
  mockGetCurrentBranch,
} = vi.hoisted(() => ({
  mockRemoveFile: vi.fn(),
  mockHasStagedChanges: vi.fn(),
  mockFileExistsAtCommit: vi.fn(),
  mockGetBranchCommitHistory: vi.fn(),
  mockGetChangedFilesForCommit: vi.fn(),
  mockGetUncommittedFileChanges: vi.fn(),
  mockGetUserInfo: vi.fn(),
  mockGetCurrentBranch: vi.fn(),
}));

vi.mock(
  '../../../../../../../modules/infrastructure/version-control',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../../../../modules/infrastructure/version-control')
      >();

    return {
      ...actual,
      removeFile: mockRemoveFile,
      hasStagedChanges: mockHasStagedChanges,
      fileExistsAtCommit: mockFileExistsAtCommit,
      getBranchCommitHistory: mockGetBranchCommitHistory,
      getChangedFilesForCommit: mockGetChangedFilesForCommit,
      getUncommittedFileChanges: mockGetUncommittedFileChanges,
      getUserInfo: mockGetUserInfo,
      getCurrentBranch: mockGetCurrentBranch,
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
    statusMatrix: vi.fn(),
  },
  Errors: {
    NotFoundError: class NotFoundError extends Error {},
  },
}));

const mockCommit = vi.mocked(git.commit);

const mockFs = {} as IsoGitFsApi;
const mockHttp = {} as IsoGitHttpApi;

const mockListDirectoryFiles = vi.fn();
const mockGetAbsolutePath = vi.fn();
const mockReadTextFile = vi.fn();
const mockWriteFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockFilesystem: Partial<Filesystem> = {
  listDirectoryFiles: mockListDirectoryFiles,
  getAbsolutePath: mockGetAbsolutePath,
  readTextFile: mockReadTextFile,
  writeFile: mockWriteFile,
  deleteFile: mockDeleteFile,
};

const PROJECT_PATH = '/projects/my-project' as ProjectId;

const store = createAdapter({
  isoGitFs: mockFs,
  filesystem: mockFilesystem as Filesystem,
  isoGitHttp: mockHttp,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: getUserInfo succeeds with a test author
  mockGetUserInfo.mockReturnValue(
    Effect.succeed({ username: 'Test', email: 'test@test.com' })
  );
});

describe('git-project-store', () => {
  describe('deleteDocumentFromProject', () => {
    const docPath = 'doc.md';
    const docId = `/blob/main/${docPath}` as ResolvedArtifactId;
    const commitOid = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';

    it('commits the removal when there are staged changes', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(Effect.succeed(true));
      mockCommit.mockResolvedValue(commitOid);

      await Effect.runPromise(
        store.deleteDocumentFromProject({
          projectId: PROJECT_PATH,
          documentId: docId,
        })
      );

      expect(mockRemoveFile).toHaveBeenCalled();
      expect(mockHasStagedChanges).toHaveBeenCalled();
      expect(mockCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Removed ${docPath}`,
        })
      );
    });

    it('skips commit when there are no staged changes', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(Effect.succeed(false));

      await Effect.runPromise(
        store.deleteDocumentFromProject({
          projectId: PROJECT_PATH,
          documentId: docId,
        })
      );

      expect(mockRemoveFile).toHaveBeenCalled();
      expect(mockHasStagedChanges).toHaveBeenCalled();
      expect(mockCommit).not.toHaveBeenCalled();
    });

    it('fails with ValidationError for an invalid document id', async () => {
      const error = await Effect.runPromise(
        store
          .deleteDocumentFromProject({
            projectId: PROJECT_PATH,
            documentId: 'not-a-blob-ref' as ResolvedArtifactId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectValidationErrorTag);
    });

    it('fails with RepositoryError when removeFile fails', async () => {
      mockRemoveFile.mockReturnValue(
        Effect.fail(new VersionControlRepositoryError('remove failed'))
      );

      const error = await Effect.runPromise(
        store
          .deleteDocumentFromProject({
            projectId: PROJECT_PATH,
            documentId: docId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });

    it('fails with RepositoryError when hasStagedChanges fails', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(
        Effect.fail(new VersionControlRepositoryError('status failed'))
      );

      const error = await Effect.runPromise(
        store
          .deleteDocumentFromProject({
            projectId: PROJECT_PATH,
            documentId: docId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });

    it('fails with RepositoryError when git.commit fails', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(Effect.succeed(true));
      mockCommit.mockRejectedValue(new Error('commit failed'));

      const error = await Effect.runPromise(
        store
          .deleteDocumentFromProject({
            projectId: PROJECT_PATH,
            documentId: docId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });
  });

  describe('deleteDocumentsFromProject', () => {
    const commitOid = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';
    const docIdA = `/blob/main/a.md` as ResolvedArtifactId;
    const docIdB = `/blob/main/b.md` as ResolvedArtifactId;
    const docIds = [docIdA, docIdB];

    it('commits removal of multiple documents when there are staged changes', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(Effect.succeed(true));
      mockCommit.mockResolvedValue(commitOid);

      await Effect.runPromise(
        store.deleteDocumentsFromProject({
          projectId: PROJECT_PATH,
          documentIds: docIds,
        })
      );

      expect(mockRemoveFile).toHaveBeenCalledTimes(2);
      expect(mockCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Removed 2 documents',
        })
      );
    });

    it('uses singular message for a single document', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(Effect.succeed(true));
      mockCommit.mockResolvedValue(commitOid);

      await Effect.runPromise(
        store.deleteDocumentsFromProject({
          projectId: PROJECT_PATH,
          documentIds: [docIdA],
        })
      );

      expect(mockCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Removed a.md',
        })
      );
    });

    it('skips commit when there are no staged changes', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(Effect.succeed(false));

      await Effect.runPromise(
        store.deleteDocumentsFromProject({
          projectId: PROJECT_PATH,
          documentIds: docIds,
        })
      );

      expect(mockRemoveFile).toHaveBeenCalledTimes(2);
      expect(mockCommit).not.toHaveBeenCalled();
    });

    it('fails with RepositoryError when removeFile fails', async () => {
      mockRemoveFile.mockReturnValue(
        Effect.fail(new VersionControlRepositoryError('remove failed'))
      );

      const error = await Effect.runPromise(
        store
          .deleteDocumentsFromProject({
            projectId: PROJECT_PATH,
            documentIds: docIds,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });

    it('fails with RepositoryError when hasStagedChanges fails', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(
        Effect.fail(new VersionControlRepositoryError('status failed'))
      );

      const error = await Effect.runPromise(
        store
          .deleteDocumentsFromProject({
            projectId: PROJECT_PATH,
            documentIds: docIds,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });

    it('fails with RepositoryError when git.commit fails', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(Effect.succeed(true));
      mockCommit.mockRejectedValue(new Error('commit failed'));

      const error = await Effect.runPromise(
        store
          .deleteDocumentsFromProject({
            projectId: PROJECT_PATH,
            documentIds: docIds,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });
  });

  describe('findDocumentInProject', () => {
    const docPath = 'doc.md';

    describe('at a specific commit', () => {
      const commitHash = 'aabbccdd';

      it('returns the document blob ref when it exists at the given commit', async () => {
        mockFileExistsAtCommit.mockReturnValue(Effect.succeed(undefined));

        const result = await Effect.runPromise(
          store.findDocumentInProject({
            projectId: PROJECT_PATH,
            documentPath: docPath,
            changeId: commitHash as ChangeId,
          })
        );

        expect(mockFileExistsAtCommit).toHaveBeenCalledWith(
          expect.objectContaining({
            commitId: commitHash,
            filepath: docPath,
          })
        );
        expect(result).toContain(`/blob/${commitHash}/${docPath}`);
      });

      it('fails with NotFoundError when document does not exist at the commit', async () => {
        mockFileExistsAtCommit.mockReturnValue(
          Effect.fail(new VersionControlNotFoundError('not found'))
        );

        const error = await Effect.runPromise(
          store
            .findDocumentInProject({
              projectId: PROJECT_PATH,
              documentPath: docPath,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedProjectNotFoundErrorTag);
      });

      it('fails with RepositoryError when the version control layer fails', async () => {
        mockFileExistsAtCommit.mockReturnValue(
          Effect.fail(new VersionControlRepositoryError('repo error'))
        );

        const error = await Effect.runPromise(
          store
            .findDocumentInProject({
              projectId: PROJECT_PATH,
              documentPath: docPath,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
      });
    });

    describe('in the current working directory', () => {
      it('returns a blob ref scoped to the current branch', async () => {
        mockGetCurrentBranch.mockReturnValue(Effect.succeed('main'));
        mockListDirectoryFiles.mockReturnValue(
          Effect.succeed([
            { name: docPath, path: docPath },
            { name: 'other.md', path: 'other.md' },
          ])
        );

        const result = await Effect.runPromise(
          store.findDocumentInProject({
            projectId: PROJECT_PATH,
            documentPath: docPath,
          })
        );

        expect(mockFileExistsAtCommit).not.toHaveBeenCalled();
        expect(result).toBe(`/blob/main/${docPath}`);
      });

      it('uses the current branch name in the blob ref', async () => {
        const featureBranch = 'feature/history';

        mockGetCurrentBranch.mockReturnValue(Effect.succeed(featureBranch));
        mockListDirectoryFiles.mockReturnValue(
          Effect.succeed([{ name: docPath, path: docPath }])
        );

        const result = await Effect.runPromise(
          store.findDocumentInProject({
            projectId: PROJECT_PATH,
            documentPath: docPath,
          })
        );

        expect(result).toBe(`/blob/${featureBranch}/${docPath}`);
      });

      it('fails with NotFoundError when the document is not in the file listing', async () => {
        mockGetCurrentBranch.mockReturnValue(Effect.succeed('main'));
        mockListDirectoryFiles.mockReturnValue(
          Effect.succeed([{ name: 'other.md', path: 'other.md' }])
        );

        const error = await Effect.runPromise(
          store
            .findDocumentInProject({
              projectId: PROJECT_PATH,
              documentPath: docPath,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedProjectNotFoundErrorTag);
      });

      it('treats uncommitted changeId the same as no changeId', async () => {
        mockGetCurrentBranch.mockReturnValue(Effect.succeed('main'));
        mockListDirectoryFiles.mockReturnValue(
          Effect.succeed([{ name: docPath, path: docPath }])
        );

        const result = await Effect.runPromise(
          store.findDocumentInProject({
            projectId: PROJECT_PATH,
            documentPath: docPath,
            changeId: UNCOMMITTED_CHANGE_ID,
          })
        );

        expect(mockFileExistsAtCommit).not.toHaveBeenCalled();
        expect(result).toContain(docPath);
      });
    });
  });

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
