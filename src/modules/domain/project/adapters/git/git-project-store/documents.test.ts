import * as Effect from 'effect/Effect';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';

import { type Username } from '../../../../../auth';
import {
  type ChangeId,
  type CommitId,
  NotFoundError as VersionControlNotFoundError,
  RepositoryError as VersionControlRepositoryError,
  type ResolvedArtifactId,
  UNCOMMITTED_CHANGE_ID,
} from '../../../../../infrastructure/version-control';
import {
  VersionedProjectDeletedDocumentErrorTag,
  VersionedProjectNotFoundErrorTag,
  VersionedProjectRepositoryErrorTag,
  VersionedProjectValidationErrorTag,
} from '../../../errors';
import { type ProjectId } from '../../../models';
import {
  buildTestStore,
  mockGetAbsolutePath,
  mockListDirectoryFiles,
  mockReadTextFile,
  mockWriteFile,
  PROJECT_PATH,
} from './test-utils';

// We mock the git-lib functions so that these tests focus on store behavior, not version-control module internals.
// vi.hoisted ensures these are available when the hoisted vi.mock factory runs.
const {
  mockRemoveFile,
  mockHasStagedChanges,
  mockFileExistsAtCommit,
  mockGetCurrentBranch,
  mockGetFileCommitHistory,
  mockGetUserInfo,
} = vi.hoisted(() => ({
  mockRemoveFile: vi.fn(),
  mockHasStagedChanges: vi.fn(),
  mockFileExistsAtCommit: vi.fn(),
  mockGetCurrentBranch: vi.fn(),
  mockGetFileCommitHistory: vi.fn(),
  mockGetUserInfo: vi.fn(),
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
      removeFile: mockRemoveFile,
      hasStagedChanges: mockHasStagedChanges,
      fileExistsAtCommit: mockFileExistsAtCommit,
      getCurrentBranch: mockGetCurrentBranch,
      getFileCommitHistory: mockGetFileCommitHistory,
      getUserInfo: mockGetUserInfo,
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

const mockCommit = vi.mocked(git.commit);
const mockGetConfig = vi.mocked(git.getConfig);
const mockResolveRef = vi.mocked(git.resolveRef);
const mockReadBlob = vi.mocked(git.readBlob);
const mockReadCommit = vi.mocked(git.readCommit);
const mockStatus = vi.mocked(git.status);

const store = buildTestStore();

const projectDir = '/test-repo';
const projectId = '/test-repo' as ProjectId;

const textEncoder = new TextEncoder();

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUserInfo.mockReturnValue(
    Effect.succeed({ username: 'Test', email: 'test@test.com' })
  );
  mockGetConfig.mockImplementation(async ({ path }) =>
    path === 'user.name'
      ? 'Test'
      : path === 'user.email'
        ? 'test@test.com'
        : undefined
  );
});

describe('documents', () => {
  describe('deleteDocument', () => {
    const docPath = 'doc.md';
    const docId = `/blob/main/${docPath}` as ResolvedArtifactId;
    const commitOid = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';

    it('commits the removal when there are staged changes', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(Effect.succeed(true));
      mockCommit.mockResolvedValue(commitOid);

      await Effect.runPromise(
        store.deleteDocument({
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
        store.deleteDocument({
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
          .deleteDocument({
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
          .deleteDocument({
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
          .deleteDocument({
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
          .deleteDocument({
            projectId: PROJECT_PATH,
            documentId: docId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });
  });

  describe('deleteDocuments', () => {
    const commitOid = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';
    const docIdA = `/blob/main/a.md` as ResolvedArtifactId;
    const docIdB = `/blob/main/b.md` as ResolvedArtifactId;
    const docIds = [docIdA, docIdB];

    it('commits removal of multiple documents when there are staged changes', async () => {
      mockRemoveFile.mockReturnValue(Effect.succeed(undefined));
      mockHasStagedChanges.mockReturnValue(Effect.succeed(true));
      mockCommit.mockResolvedValue(commitOid);

      await Effect.runPromise(
        store.deleteDocuments({
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
        store.deleteDocuments({
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
        store.deleteDocuments({
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
          .deleteDocuments({
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
          .deleteDocuments({
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
          .deleteDocuments({
            projectId: PROJECT_PATH,
            documentIds: docIds,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });
  });

  describe('lookupDocumentInProject', () => {
    const docPath = 'doc.md';

    describe('at a specific commit', () => {
      const commitHash = 'aabbccdd';

      it('returns the document blob ref when it exists at the given commit', async () => {
        mockFileExistsAtCommit.mockReturnValue(Effect.succeed(undefined));

        const result = await Effect.runPromise(
          store.lookupDocumentInProject({
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
            .lookupDocumentInProject({
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
            .lookupDocumentInProject({
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
          store.lookupDocumentInProject({
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
          store.lookupDocumentInProject({
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
            .lookupDocumentInProject({
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
          store.lookupDocumentInProject({
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

  describe('getDocumentAtChange', () => {
    const docPath = 'doc.md';

    describe('when changeId is a commit hash', () => {
      const commitHash = 'abc1234';
      const docId = `/blob/${commitHash}/${docPath}` as ResolvedArtifactId;
      const commitOid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      it('returns the document content at the given commit', async () => {
        const content = '# Hello World';

        mockResolveRef.mockResolvedValue(commitOid);
        mockReadBlob.mockResolvedValue({
          oid: 'bloboid',
          blob: textEncoder.encode(content),
        } as Awaited<ReturnType<typeof git.readBlob>>);

        const result = await Effect.runPromise(
          store.getDocumentAtChange({
            projectId,
            documentId: docId,
            changeId: commitHash as ChangeId,
          })
        );

        expect(result.content).toBe(content);
        expect(result.type).toBe('RICH_TEXT_DOCUMENT');
      });

      it('fails with NotFoundError when document never existed at the commit', async () => {
        mockResolveRef.mockResolvedValue(commitOid);
        mockReadBlob.mockRejectedValue(
          new IsoGitErrors.NotFoundError('not found')
        );
        // Initial commit — no parents
        mockReadCommit.mockResolvedValue({
          commit: { parent: [] as string[] },
        } as Awaited<ReturnType<typeof git.readCommit>>);

        const error = await Effect.runPromise(
          store
            .getDocumentAtChange({
              projectId,
              documentId: docId,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedProjectNotFoundErrorTag);
      });

      it('fails with DeletedDocumentError when document existed in parent but not at commit', async () => {
        const parentOid = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

        mockResolveRef.mockResolvedValue(commitOid);
        // First readBlob (for the commit itself) fails — document not found
        mockReadBlob
          .mockRejectedValueOnce(new IsoGitErrors.NotFoundError('not found'))
          // Second readBlob (for the parent commit) succeeds — document existed in parent
          .mockResolvedValueOnce({
            oid: 'bloboid',
            blob: textEncoder.encode('old content'),
          } as Awaited<ReturnType<typeof git.readBlob>>);
        mockReadCommit.mockResolvedValue({
          commit: { parent: [parentOid] },
        } as Awaited<ReturnType<typeof git.readCommit>>);

        const error = await Effect.runPromise(
          store
            .getDocumentAtChange({
              projectId,
              documentId: docId,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedProjectDeletedDocumentErrorTag);
        expect(
          (error as { data: { parentCommitId: string } }).data.parentCommitId
        ).toBe(parentOid);
      });

      it('fails with NotFoundError when document is absent in both commit and parent', async () => {
        const parentOid = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

        mockResolveRef.mockResolvedValue(commitOid);
        mockReadBlob
          .mockRejectedValueOnce(new IsoGitErrors.NotFoundError('not found'))
          .mockRejectedValueOnce(
            new IsoGitErrors.NotFoundError('not found in parent')
          );
        mockReadCommit.mockResolvedValue({
          commit: { parent: [parentOid] },
        } as Awaited<ReturnType<typeof git.readCommit>>);

        const error = await Effect.runPromise(
          store
            .getDocumentAtChange({
              projectId,
              documentId: docId,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedProjectNotFoundErrorTag);
      });

      it('fails with RepositoryError when readBlob fails with a non-NotFoundError', async () => {
        mockReadBlob.mockRejectedValue(new Error('read error'));

        const error = await Effect.runPromise(
          store
            .getDocumentAtChange({
              projectId,
              documentId: docId,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
      });
    });

    describe('when changeId is uncommitted', () => {
      const docId = `/blob/main/${docPath}` as ResolvedArtifactId;

      it('returns the current document from the filesystem', async () => {
        const content = '# Current content';

        mockGetAbsolutePath.mockReturnValue(
          Effect.succeed(`${projectDir}/${docPath}`)
        );
        mockReadTextFile.mockReturnValue(Effect.succeed({ content }));

        const result = await Effect.runPromise(
          store.getDocumentAtChange({
            projectId,
            documentId: docId,
            changeId: UNCOMMITTED_CHANGE_ID,
          })
        );

        expect(result.content).toBe(content);
      });
    });

    describe('validation', () => {
      it('fails with ValidationError for an invalid document id', async () => {
        const error = await Effect.runPromise(
          store
            .getDocumentAtChange({
              projectId,
              documentId: 'not-a-blob-ref' as ResolvedArtifactId,
              changeId: 'abc1234' as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedProjectValidationErrorTag);
      });

      it('fails with ValidationError for an invalid commit hash', async () => {
        const error = await Effect.runPromise(
          store
            .getDocumentAtChange({
              projectId,
              documentId: `/blob/abc1234/${docPath}` as ResolvedArtifactId,
              changeId: 'not-a-hash!' as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedProjectValidationErrorTag);
      });
    });
  });

  describe('discardUncommittedChanges', () => {
    const docPath = 'doc.md';
    const docId = `/blob/main/${docPath}` as ResolvedArtifactId;
    const lastCommitOid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    beforeEach(() => {
      mockGetAbsolutePath.mockReturnValue(
        Effect.succeed(`${projectDir}/${docPath}`)
      );
      mockReadTextFile.mockReturnValue(
        Effect.succeed({ content: 'current content' })
      );
    });

    it('restores document from the last commit when it exists there', async () => {
      const restoredContent = '# Committed content';

      mockStatus.mockResolvedValue('*modified');
      mockGetFileCommitHistory.mockReturnValue(
        Effect.succeed([
          {
            id: lastCommitOid as CommitId,
            message: 'initial',
            time: new Date('2025-01-01'),
            author: { username: 'Test' as Username },
          },
        ])
      );
      mockResolveRef.mockResolvedValue(lastCommitOid);
      mockReadBlob.mockResolvedValue({
        oid: 'bloboid',
        blob: textEncoder.encode(restoredContent),
      } as Awaited<ReturnType<typeof git.readBlob>>);
      mockWriteFile.mockReturnValue(Effect.succeed(undefined));

      await Effect.runPromise(
        store.discardUncommittedChanges({
          projectId,
          documentId: docId,
        })
      );

      expect(mockWriteFile).toHaveBeenCalledWith({
        path: `${projectDir}/${docPath}`,
        content: restoredContent,
      });
    });

    it('restores from parent commit when document was deleted in last commit', async () => {
      const parentOid = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      mockStatus.mockResolvedValue('*modified');
      mockGetFileCommitHistory.mockReturnValue(
        Effect.succeed([
          {
            id: lastCommitOid as CommitId,
            message: 'deleted doc',
            time: new Date('2025-02-01'),
            author: { username: 'Test' as Username },
          },
        ])
      );
      // getDocumentAtCommit for last commit: document not found → deleted
      mockResolveRef
        .mockResolvedValueOnce(lastCommitOid)
        .mockResolvedValueOnce(parentOid);
      mockReadBlob
        // 1. readBlob at last commit — document not found
        .mockRejectedValueOnce(new IsoGitErrors.NotFoundError('not found'))
        // 2. readBlob at parent — confirms the document existed (deletion detection)
        .mockResolvedValueOnce({
          oid: 'bloboid',
          blob: textEncoder.encode('parent content'),
        } as Awaited<ReturnType<typeof git.readBlob>>)
        // 3. readBlob at parent again — reads the content to restore
        .mockResolvedValueOnce({
          oid: 'bloboid',
          blob: textEncoder.encode('parent content'),
        } as Awaited<ReturnType<typeof git.readBlob>>);
      mockReadCommit.mockResolvedValue({
        commit: { parent: [parentOid] },
      } as Awaited<ReturnType<typeof git.readCommit>>);
      mockWriteFile.mockReturnValue(Effect.succeed(undefined));

      await Effect.runPromise(
        store.discardUncommittedChanges({
          projectId,
          documentId: docId,
        })
      );

      expect(mockWriteFile).toHaveBeenCalledWith({
        path: `${projectDir}/${docPath}`,
        content: 'parent content',
      });
    });

    it('fails when deleted document has no parent commit', async () => {
      mockStatus.mockResolvedValue('*modified');
      mockGetFileCommitHistory.mockReturnValue(
        Effect.succeed([
          {
            id: lastCommitOid as CommitId,
            message: 'deleted doc',
            time: new Date('2025-02-01'),
            author: { username: 'Test' as Username },
          },
        ])
      );
      mockResolveRef.mockResolvedValue(lastCommitOid);
      mockReadBlob.mockRejectedValueOnce(
        new IsoGitErrors.NotFoundError('not found')
      );
      mockReadCommit.mockResolvedValue({
        commit: { parent: [] as string[] },
      } as Awaited<ReturnType<typeof git.readCommit>>);

      const error = await Effect.runPromise(
        store
          .discardUncommittedChanges({
            projectId,
            documentId: docId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectNotFoundErrorTag);
    });

    it('fails with NotFoundError when there are no uncommitted changes', async () => {
      mockStatus.mockResolvedValue('unmodified');
      mockGetFileCommitHistory.mockReturnValue(
        Effect.succeed([
          {
            id: lastCommitOid as CommitId,
            message: 'initial',
            time: new Date('2025-01-01'),
            author: { username: 'Test' as Username },
          },
        ])
      );

      const error = await Effect.runPromise(
        store
          .discardUncommittedChanges({
            projectId,
            documentId: docId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectNotFoundErrorTag);
    });

    it('fails with RepositoryError when there are only uncommitted changes and no commits', async () => {
      mockStatus.mockResolvedValue('*modified');
      mockGetFileCommitHistory.mockReturnValue(Effect.succeed([]));

      const error = await Effect.runPromise(
        store
          .discardUncommittedChanges({
            projectId,
            documentId: docId,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
    });
  });
});
