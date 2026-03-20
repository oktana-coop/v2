import * as Effect from 'effect/Effect';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import { type Username } from '../../../../../../auth';
import { type Filesystem } from '../../../../../../infrastructure/filesystem';
import {
  type ChangeId,
  type CommitId,
  type ResolvedArtifactId,
  UNCOMMITTED_CHANGE_ID,
} from '../../../../../../infrastructure/version-control';
import {
  VersionedDocumentDeletedDocumentErrorTag,
  VersionedDocumentNotFoundErrorTag,
  VersionedDocumentRepositoryErrorTag,
  VersionedDocumentValidationErrorTag,
} from '../../../../errors';
import { createAdapter } from './index';

// We mock the git-lib functions so that these tests focus on store behavior, not version-control module internals.
// vi.hoisted ensures these are available when the hoisted vi.mock factory runs.
const { mockGetFileCommitHistory } = vi.hoisted(() => ({
  mockGetFileCommitHistory: vi.fn(),
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
      getFileCommitHistory: mockGetFileCommitHistory,
    };
  }
);

vi.mock('isomorphic-git', () => ({
  default: {
    currentBranch: vi.fn(),
    resolveRef: vi.fn(),
    readBlob: vi.fn(),
    readCommit: vi.fn(),
    status: vi.fn(),
    add: vi.fn(),
    commit: vi.fn(),
    hashBlob: vi.fn(),
  },
  Errors: {
    NotFoundError: class NotFoundError extends Error {},
  },
}));

const mockResolveRef = vi.mocked(git.resolveRef);
const mockReadBlob = vi.mocked(git.readBlob);
const mockReadCommit = vi.mocked(git.readCommit);
const mockStatus = vi.mocked(git.status);

const mockFs = {} as IsoGitFsApi;
const projectDir = '/test-repo';
const projectId = '/test-repo';

const mockReadTextFile = vi.fn();
const mockWriteFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockGetAbsolutePath = vi.fn();
const mockFilesystem: Partial<Filesystem> = {
  readTextFile: mockReadTextFile,
  writeFile: mockWriteFile,
  deleteFile: mockDeleteFile,
  getAbsolutePath: mockGetAbsolutePath,
};

const store = createAdapter({
  isoGitFs: mockFs,
  filesystem: mockFilesystem as Filesystem,
  projectId,
  projectDir,
  managesFilesystemWorkdir: true,
});

const textEncoder = new TextEncoder();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('git-versioned-document-store', () => {
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
              documentId: docId,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedDocumentNotFoundErrorTag);
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
              documentId: docId,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedDocumentDeletedDocumentErrorTag);
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
              documentId: docId,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedDocumentNotFoundErrorTag);
      });

      it('fails with RepositoryError when resolveRef fails with a non-NotFoundError', async () => {
        mockResolveRef.mockRejectedValue(new Error('repo corrupted'));

        const error = await Effect.runPromise(
          store
            .getDocumentAtChange({
              documentId: docId,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedDocumentRepositoryErrorTag);
      });

      it('fails with RepositoryError when readBlob fails with a non-NotFoundError', async () => {
        mockResolveRef.mockResolvedValue(commitOid);
        mockReadBlob.mockRejectedValue(new Error('read error'));

        const error = await Effect.runPromise(
          store
            .getDocumentAtChange({
              documentId: docId,
              changeId: commitHash as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedDocumentRepositoryErrorTag);
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
              documentId: 'not-a-blob-ref' as ResolvedArtifactId,
              changeId: 'abc1234' as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedDocumentValidationErrorTag);
      });

      it('fails with ValidationError for an invalid commit hash', async () => {
        const error = await Effect.runPromise(
          store
            .getDocumentAtChange({
              documentId: `/blob/abc1234/${docPath}` as ResolvedArtifactId,
              changeId: 'not-a-hash!' as ChangeId,
            })
            .pipe(Effect.flip)
        );

        expect(error._tag).toBe(VersionedDocumentValidationErrorTag);
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
          documentId: docId,
          writeToFileWithPath: `${projectDir}/${docPath}`,
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
          documentId: docId,
          writeToFileWithPath: `${projectDir}/${docPath}`,
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
            documentId: docId,
            writeToFileWithPath: `${projectDir}/${docPath}`,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedDocumentNotFoundErrorTag);
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
            documentId: docId,
            writeToFileWithPath: `${projectDir}/${docPath}`,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedDocumentNotFoundErrorTag);
    });

    it('fails with RepositoryError when there are only uncommitted changes and no commits', async () => {
      mockStatus.mockResolvedValue('*modified');
      mockGetFileCommitHistory.mockReturnValue(Effect.succeed([]));

      const error = await Effect.runPromise(
        store
          .discardUncommittedChanges({
            documentId: docId,
            writeToFileWithPath: `${projectDir}/${docPath}`,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedDocumentRepositoryErrorTag);
    });
  });
});
