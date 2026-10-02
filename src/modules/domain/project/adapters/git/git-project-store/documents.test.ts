import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';

import { type Username } from '../../../../../auth';
import {
  AlreadyExistsError as FilesystemAlreadyExistsError,
  FilesystemAlreadyExistsErrorTag,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../infrastructure/filesystem';
import {
  type ArtifactId,
  type Branch,
  type ChangeId,
  type CommitId,
  NotFoundError as VersionControlNotFoundError,
  RepositoryError as VersionControlRepositoryError,
  UNCOMMITTED_CHANGE_ID,
} from '../../../../../infrastructure/version-control';
import { PRIMARY_RICH_TEXT_REPRESENTATION } from '../../../../rich-text';
import {
  VersionedProjectDeletedDocumentErrorTag,
  VersionedProjectDocumentNotOnCurrentRefErrorTag,
  VersionedProjectNotFoundErrorTag,
  VersionedProjectRepositoryErrorTag,
  VersionedProjectValidationErrorTag,
} from '../../../errors';
import { parseProjectRelPath, type ProjectId } from '../../../models';
import {
  buildTestStore,
  mockCreateFile,
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
  mockIsRefCheckedOut,
  mockSwitchToBranch,
  mockCreateAndSwitchToBranch,
  mockDeleteBranch,
  mockMergeAndDeleteBranch,
} = vi.hoisted(() => ({
  mockRemoveFile: vi.fn(),
  mockHasStagedChanges: vi.fn(),
  mockFileExistsAtCommit: vi.fn(),
  mockGetCurrentBranch: vi.fn(),
  mockGetFileCommitHistory: vi.fn(),
  mockGetUserInfo: vi.fn(),
  mockIsRefCheckedOut: vi.fn(),
  mockSwitchToBranch: vi.fn(),
  mockCreateAndSwitchToBranch: vi.fn(),
  mockDeleteBranch: vi.fn(),
  mockMergeAndDeleteBranch: vi.fn(),
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
      isRefCheckedOut: mockIsRefCheckedOut,
      switchToBranch: mockSwitchToBranch,
      createAndSwitchToBranch: mockCreateAndSwitchToBranch,
      deleteBranch: mockDeleteBranch,
      mergeAndDeleteBranch: mockMergeAndDeleteBranch,
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
  describe('findDocumentById', () => {
    const store = buildTestStore();
    const docId = '/blob/main/notes.md' as ArtifactId;

    beforeEach(() => {
      mockGetAbsolutePath.mockReturnValue(
        Effect.succeed(`${PROJECT_PATH}/notes.md`)
      );
      mockIsRefCheckedOut.mockReturnValue(Effect.succeed(true));
      mockGetCurrentBranch.mockReturnValue(Effect.succeed('main'));
      mockReadTextFile.mockReturnValue(Effect.succeed({ content: '# Notes' }));
    });

    it('reads a document whose branch is checked out', async () => {
      const document = await Effect.runPromise(
        store.findDocumentById({ projectId: PROJECT_PATH, documentId: docId })
      );

      expect(document.artifact.content).toBe('# Notes');
      expect(mockIsRefCheckedOut).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'main', refType: 'branch-or-tag' })
      );
    });

    it('reads a document whose commit is checked out', async () => {
      const document = await Effect.runPromise(
        store.findDocumentById({
          projectId: PROJECT_PATH,
          documentId: '/blob/4a1d2e3f/notes.md' as ArtifactId,
        })
      );

      expect(document.artifact.content).toBe('# Notes');
      expect(mockIsRefCheckedOut).toHaveBeenCalledWith(
        expect.objectContaining({ ref: '4a1d2e3f', refType: 'commit' })
      );
    });

    it('refuses a document whose ref is not checked out, without reading its file', async () => {
      mockIsRefCheckedOut.mockReturnValue(Effect.succeed(false));
      mockGetCurrentBranch.mockReturnValue(Effect.succeed('draft'));

      const failure = await Effect.runPromise(
        Effect.flip(
          store.findDocumentById({ projectId: PROJECT_PATH, documentId: docId })
        )
      );

      expect(failure._tag).toBe(
        VersionedProjectDocumentNotOnCurrentRefErrorTag
      );
      expect(failure).toHaveProperty('data', { currentBranch: 'draft' });
      expect(mockReadTextFile).not.toHaveBeenCalled();
    });

    it('refuses a document whose ref stops being checked out while its file is read', async () => {
      mockIsRefCheckedOut
        .mockReturnValueOnce(Effect.succeed(true))
        .mockReturnValueOnce(Effect.succeed(false));
      mockGetCurrentBranch.mockReturnValue(Effect.succeed('draft'));

      const failure = await Effect.runPromise(
        Effect.flip(
          store.findDocumentById({ projectId: PROJECT_PATH, documentId: docId })
        )
      );

      expect(failure._tag).toBe(
        VersionedProjectDocumentNotOnCurrentRefErrorTag
      );
      expect(mockIsRefCheckedOut).toHaveBeenCalledTimes(2);
    });

    it('refuses with no current branch while HEAD is detached', async () => {
      mockIsRefCheckedOut.mockReturnValue(Effect.succeed(false));
      mockGetCurrentBranch.mockReturnValue(
        Effect.fail(new VersionControlNotFoundError('detached HEAD'))
      );

      const failure = await Effect.runPromise(
        Effect.flip(
          store.findDocumentById({ projectId: PROJECT_PATH, documentId: docId })
        )
      );

      expect(failure._tag).toBe(
        VersionedProjectDocumentNotOnCurrentRefErrorTag
      );
      expect(failure).toHaveProperty('data', { currentBranch: null });
      expect(mockReadTextFile).not.toHaveBeenCalled();
    });

    it('fails with NotFoundError when the project has no such document', async () => {
      mockReadTextFile.mockReturnValue(
        Effect.fail(new FilesystemNotFoundError('no such file'))
      );

      const failure = await Effect.runPromise(
        Effect.flip(
          store.findDocumentById({ projectId: PROJECT_PATH, documentId: docId })
        )
      );

      expect(failure._tag).toBe(VersionedProjectNotFoundErrorTag);
    });

    it('fails with RepositoryError when the file cannot be read', async () => {
      mockReadTextFile.mockReturnValue(
        Effect.fail(new FilesystemRepositoryError('disk is unhappy'))
      );

      const failure = await Effect.runPromise(
        Effect.flip(
          store.findDocumentById({ projectId: PROJECT_PATH, documentId: docId })
        )
      );

      expect(failure._tag).toBe(VersionedProjectRepositoryErrorTag);
    });
  });

  describe('createDocument', () => {
    const store = buildTestStore();

    beforeEach(() => {
      mockGetAbsolutePath.mockImplementation(({ path, dirPath }) =>
        Effect.succeed(`${dirPath}/${path}`)
      );
      mockGetCurrentBranch.mockReturnValue(Effect.succeed('main'));
      mockCreateFile.mockReturnValue(Effect.void);
    });

    it('creates an empty file and returns its id on the current branch', async () => {
      const documentId = await Effect.runPromise(
        store.createDocument({ projectId: PROJECT_PATH, name: 'notes.md' })
      );

      expect(documentId).toBe('/blob/main/notes.md');
      expect(mockCreateFile).toHaveBeenCalledWith({
        path: `${PROJECT_PATH}/notes.md`,
        content: '',
      });
    });

    it('creates the file inside the parent directory', async () => {
      const documentId = await Effect.runPromise(
        store.createDocument({
          projectId: PROJECT_PATH,
          parentDirectoryPath: parseProjectRelPath('drafts'),
          name: 'config.yaml',
        })
      );

      expect(documentId).toBe('/blob/main/drafts/config.yaml');
      expect(mockCreateFile).toHaveBeenCalledWith({
        path: `${PROJECT_PATH}/drafts/config.yaml`,
        content: '',
      });
    });

    it('leaves a name collision as the filesystem reports it', async () => {
      mockCreateFile.mockReturnValue(
        Effect.fail(new FilesystemAlreadyExistsError('notes.md exists'))
      );

      const failure = await Effect.runPromise(
        Effect.flip(
          store.createDocument({ projectId: PROJECT_PATH, name: 'notes.md' })
        )
      );

      expect(failure._tag).toBe(FilesystemAlreadyExistsErrorTag);
    });

    it('creates no file when HEAD is detached', async () => {
      mockGetCurrentBranch.mockReturnValue(
        Effect.fail(new VersionControlNotFoundError('HEAD is detached'))
      );

      const failure = await Effect.runPromise(
        Effect.flip(
          store.createDocument({ projectId: PROJECT_PATH, name: 'notes.md' })
        )
      );

      expect(failure._tag).toBe(VersionedProjectRepositoryErrorTag);
      expect(mockCreateFile).not.toHaveBeenCalled();
    });
  });

  describe('updateRichTextDocumentContent', () => {
    const store = buildTestStore();
    const docId = '/blob/main/notes.md' as ArtifactId;

    beforeEach(() => {
      mockGetAbsolutePath.mockReturnValue(
        Effect.succeed(`${PROJECT_PATH}/notes.md`)
      );
      mockIsRefCheckedOut.mockReturnValue(Effect.succeed(true));
      mockGetCurrentBranch.mockReturnValue(Effect.succeed('main'));
      mockWriteFile.mockReturnValue(Effect.succeed(undefined));
    });

    it('writes a document whose ref is checked out', async () => {
      await Effect.runPromise(
        store.updateRichTextDocumentContent({
          projectId: PROJECT_PATH,
          documentId: docId,
          representation: PRIMARY_RICH_TEXT_REPRESENTATION,
          content: '# Notes, edited',
        })
      );

      expect(mockWriteFile).toHaveBeenCalledWith({
        path: `${PROJECT_PATH}/notes.md`,
        content: '# Notes, edited',
      });
    });

    it('refuses a document whose ref is not checked out, without writing its file', async () => {
      mockIsRefCheckedOut.mockReturnValue(Effect.succeed(false));
      mockGetCurrentBranch.mockReturnValue(Effect.succeed('draft'));

      const failure = await Effect.runPromise(
        Effect.flip(
          store.updateRichTextDocumentContent({
            projectId: PROJECT_PATH,
            documentId: docId,
            representation: PRIMARY_RICH_TEXT_REPRESENTATION,
            content: '# Notes, edited',
          })
        )
      );

      expect(failure._tag).toBe(
        VersionedProjectDocumentNotOnCurrentRefErrorTag
      );
      expect(failure).toHaveProperty('data', { currentBranch: 'draft' });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('fails, after writing, when the ref stops being checked out while its file is written', async () => {
      mockIsRefCheckedOut
        .mockReturnValueOnce(Effect.succeed(true))
        .mockReturnValueOnce(Effect.succeed(false));
      mockGetCurrentBranch.mockReturnValue(Effect.succeed('draft'));

      const failure = await Effect.runPromise(
        Effect.flip(
          store.updateRichTextDocumentContent({
            projectId: PROJECT_PATH,
            documentId: docId,
            representation: PRIMARY_RICH_TEXT_REPRESENTATION,
            content: '# Notes, edited',
          })
        )
      );

      expect(failure._tag).toBe(
        VersionedProjectDocumentNotOnCurrentRefErrorTag
      );
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('while the checked-out branch is being changed', () => {
    type Store = ReturnType<typeof buildTestStore>;

    const main = 'main' as Branch;
    const draft = 'draft' as Branch;
    const experiment = 'experiment' as Branch;
    const docId = `/blob/${draft}/notes.md` as ArtifactId;

    // Every store operation that moves HEAD, here away from draft.
    const branchChanges = [
      {
        name: 'switchToBranch',
        gitOperation: mockSwitchToBranch,
        movesHeadTo: main,
        run: (store: Store) =>
          store.switchToBranch({ projectId: PROJECT_PATH, branch: main }),
      },
      {
        name: 'createAndSwitchToBranch',
        gitOperation: mockCreateAndSwitchToBranch,
        movesHeadTo: experiment,
        run: (store: Store) =>
          store.createAndSwitchToBranch({
            projectId: PROJECT_PATH,
            branch: experiment,
          }),
      },
      {
        name: 'deleteBranch',
        gitOperation: mockDeleteBranch,
        movesHeadTo: main,
        run: (store: Store) =>
          store.deleteBranch({ projectId: PROJECT_PATH, branch: draft }),
      },
      {
        name: 'mergeAndDeleteBranch',
        gitOperation: mockMergeAndDeleteBranch,
        movesHeadTo: main,
        run: (store: Store) =>
          store.mergeAndDeleteBranch({
            projectId: PROJECT_PATH,
            from: draft,
            into: main,
          }),
      },
    ];

    type BranchChange = (typeof branchChanges)[number];

    // Yields until everything that can run without the pending step has run.
    const settle = () => new Promise((resolve) => setImmediate(resolve));

    // The change moves HEAD only once the test lets it finish.
    const startBranchChange = async ({
      gitOperation,
      movesHeadTo,
      run,
    }: BranchChange) => {
      const store = buildTestStore();
      const finished = Effect.runSync(Deferred.make<void>());

      gitOperation.mockReturnValue(
        pipe(
          Deferred.await(finished),
          Effect.tap(() =>
            Effect.sync(() => {
              mockIsRefCheckedOut.mockReturnValue(Effect.succeed(false));
              mockGetCurrentBranch.mockReturnValue(Effect.succeed(movesHeadTo));
            })
          )
        )
      );

      const changed = Effect.runPromise(Effect.asVoid(run(store)));
      await settle();

      return {
        store,
        changed,
        finish: () => Effect.runPromise(Deferred.succeed(finished, undefined)),
      };
    };

    beforeEach(() => {
      mockGetAbsolutePath.mockReturnValue(
        Effect.succeed(`${PROJECT_PATH}/notes.md`)
      );
      mockIsRefCheckedOut.mockReturnValue(Effect.succeed(true));
      mockGetCurrentBranch.mockReturnValue(Effect.succeed(draft));
      mockReadTextFile.mockReturnValue(Effect.succeed({ content: '# Notes' }));
      mockWriteFile.mockReturnValue(Effect.succeed(undefined));
    });

    it.each(branchChanges)(
      'holds a read issued during $name until it is over, then refuses it',
      async (branchChange) => {
        const { store, changed, finish } =
          await startBranchChange(branchChange);

        const read = Effect.runPromise(
          Effect.flip(
            store.findDocumentById({
              projectId: PROJECT_PATH,
              documentId: docId,
            })
          )
        );
        await settle();

        expect(mockIsRefCheckedOut).not.toHaveBeenCalled();
        expect(mockReadTextFile).not.toHaveBeenCalled();

        await finish();
        await changed;
        const failure = await read;

        expect(failure._tag).toBe(
          VersionedProjectDocumentNotOnCurrentRefErrorTag
        );
        expect(failure).toHaveProperty('data', {
          currentBranch: branchChange.movesHeadTo,
        });
        expect(mockReadTextFile).not.toHaveBeenCalled();
      }
    );

    it('holds a write issued during a switch until it is over, then refuses it', async () => {
      const [switchToMain] = branchChanges;
      const { store, changed, finish } = await startBranchChange(switchToMain);

      const write = Effect.runPromise(
        Effect.flip(
          store.updateRichTextDocumentContent({
            projectId: PROJECT_PATH,
            documentId: docId,
            representation: PRIMARY_RICH_TEXT_REPRESENTATION,
            content: '# Notes, edited',
          })
        )
      );
      await settle();

      expect(mockIsRefCheckedOut).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();

      await finish();
      await changed;
      const failure = await write;

      expect(failure._tag).toBe(
        VersionedProjectDocumentNotOnCurrentRefErrorTag
      );
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('holds a create issued during a switch until it is over, then creates it on the branch switched to', async () => {
      const store = buildTestStore();
      const finished = Effect.runSync(Deferred.make<void>());
      // HEAD is read when the store looks the branch up, not when it builds
      // the lookup, as with the real git call.
      let head = draft;
      mockGetCurrentBranch.mockImplementation(() => Effect.sync(() => head));
      mockSwitchToBranch.mockReturnValue(
        pipe(
          Deferred.await(finished),
          Effect.tap(() =>
            Effect.sync(() => {
              head = main;
            })
          )
        )
      );
      mockGetAbsolutePath.mockImplementation(({ path, dirPath }) =>
        Effect.succeed(`${dirPath}/${path}`)
      );
      mockCreateFile.mockReturnValue(Effect.void);

      const switched = Effect.runPromise(
        store.switchToBranch({ projectId: PROJECT_PATH, branch: main })
      );
      await settle();
      const created = Effect.runPromise(
        store.createDocument({ projectId: PROJECT_PATH, name: 'new.md' })
      );
      await settle();

      expect(mockCreateFile).not.toHaveBeenCalled();

      await Effect.runPromise(Deferred.succeed(finished, undefined));
      await switched;
      const documentId = await created;

      expect(documentId).toBe(`/blob/${main}/new.md`);
      expect(mockCreateFile).toHaveBeenCalled();
    });

    it('holds a switch issued during a read until the read is over', async () => {
      const store = buildTestStore();
      const fileRead = Effect.runSync(Deferred.make<void>());
      mockReadTextFile.mockReturnValue(
        pipe(Deferred.await(fileRead), Effect.as({ content: '# Notes' }))
      );
      mockSwitchToBranch.mockReturnValue(Effect.void);

      const read = Effect.runPromise(
        store.findDocumentById({ projectId: PROJECT_PATH, documentId: docId })
      );
      await settle();
      const switched = Effect.runPromise(
        store.switchToBranch({ projectId: PROJECT_PATH, branch: main })
      );
      await settle();

      expect(mockSwitchToBranch).not.toHaveBeenCalled();

      await Effect.runPromise(Deferred.succeed(fileRead, undefined));
      const document = await read;
      await switched;

      expect(document.artifact.content).toBe('# Notes');
      expect(mockSwitchToBranch).toHaveBeenCalled();
    });
  });

  describe('deleteDocument', () => {
    const docPath = 'doc.md';
    const docId = `/blob/main/${docPath}` as ArtifactId;
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
            documentId: 'not-a-blob-ref' as ArtifactId,
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
    const docIdA = `/blob/main/a.md` as ArtifactId;
    const docIdB = `/blob/main/b.md` as ArtifactId;
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
      const docId = `/blob/${commitHash}/${docPath}` as ArtifactId;
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
        expect(result.representation).toBe(PRIMARY_RICH_TEXT_REPRESENTATION);
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
      const docId = `/blob/main/${docPath}` as ArtifactId;

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
              documentId: 'not-a-blob-ref' as ArtifactId,
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
              documentId: `/blob/abc1234/${docPath}` as ArtifactId,
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
    const docId = `/blob/main/${docPath}` as ArtifactId;
    const lastCommitOid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    beforeEach(() => {
      mockGetAbsolutePath.mockReturnValue(
        Effect.succeed(`${projectDir}/${docPath}`)
      );
      mockIsRefCheckedOut.mockReturnValue(Effect.succeed(true));
      mockGetCurrentBranch.mockReturnValue(Effect.succeed('main'));
      mockReadTextFile.mockReturnValue(
        Effect.succeed({ content: 'current content' })
      );
    });

    it('refuses a document whose ref is not checked out, without touching its file', async () => {
      mockIsRefCheckedOut.mockReturnValue(Effect.succeed(false));
      mockGetCurrentBranch.mockReturnValue(Effect.succeed('draft'));

      const failure = await Effect.runPromise(
        Effect.flip(
          store.discardUncommittedChanges({ projectId, documentId: docId })
        )
      );

      expect(failure._tag).toBe(
        VersionedProjectDocumentNotOnCurrentRefErrorTag
      );
      expect(failure).toHaveProperty('data', { currentBranch: 'draft' });
      expect(mockReadTextFile).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
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
