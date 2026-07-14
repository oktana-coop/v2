import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';

import {
  type ArtifactId,
  type Commit,
} from '../../../../../infrastructure/version-control';
import { VersionedProjectRepositoryErrorTag } from '../../../errors';
import {
  buildTestStore,
  mockEnsureDirectory,
  mockExists,
  mockExtractLocalAssetReferences,
  mockGetAbsolutePath,
  mockReadTextFile,
  mockWriteFile,
  PROJECT_PATH,
} from './test-utils';

// We mock the git-lib functions so that these tests focus on store behavior, not version-control module internals.
// vi.hoisted ensures these are available when the hoisted vi.mock factory runs.
const { mockGetUserInfo } = vi.hoisted(() => ({
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

const store = buildTestStore();

beforeEach(() => {
  vi.clearAllMocks();
  mockExtractLocalAssetReferences.mockReturnValue(Effect.succeed([]));
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

describe('committing', () => {
  describe('commitDocumentChanges', () => {
    const docPath = 'doc.md';
    const docId = `/blob/main/${docPath}` as ArtifactId;
    const commitOid = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';

    beforeEach(() => {
      mockGetAbsolutePath.mockImplementation(({ path, dirPath }) =>
        Effect.succeed(`${dirPath}/${path}`)
      );
      mockReadTextFile.mockReturnValue(
        Effect.succeed({
          type: 'FILE',
          name: docPath,
          path: docPath,
          content: '',
        })
      );
      vi.mocked(git.add).mockResolvedValue(undefined);
      mockCommit.mockResolvedValue(commitOid);
    });

    it('stages only the assets that exist on disk and reports the skipped ones', async () => {
      mockExtractLocalAssetReferences.mockReturnValue(
        Effect.succeed(['assets/present.png', 'assets/missing.png'])
      );
      mockExists.mockImplementation((path: string) =>
        Effect.succeed(path.endsWith('present.png'))
      );

      const result = await Effect.runPromise(
        store.commitDocumentChanges({
          projectId: PROJECT_PATH,
          documentId: docId,
          message: 'msg',
        })
      );

      expect(result.skippedAssetPaths).toEqual(['assets/missing.png']);
      const stagedPaths = (
        vi.mocked(git.add).mock.calls[0][0] as { filepath: string[] }
      ).filepath;
      expect(stagedPaths).toEqual([docPath, 'assets/present.png']);
      expect(mockCommit).toHaveBeenCalled();
    });

    it('reports no skipped assets when every referenced asset exists', async () => {
      mockExtractLocalAssetReferences.mockReturnValue(
        Effect.succeed(['assets/present.png'])
      );
      mockExists.mockReturnValue(Effect.succeed(true));

      const result = await Effect.runPromise(
        store.commitDocumentChanges({
          projectId: PROJECT_PATH,
          documentId: docId,
          message: 'msg',
        })
      );

      expect(result.skippedAssetPaths).toEqual([]);
      expect(mockCommit).toHaveBeenCalled();
    });
  });

  describe('restoreDocumentChanges', () => {
    const docPath = 'doc.md';
    const docId = `/blob/main/${docPath}` as ArtifactId;
    const sourceCommitOid = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';
    const restoreCommitOid = 'ffeeddccffeeddccffeeddccffeeddccffeeddcc';
    const commit = { id: sourceCommitOid, message: 'old' } as Commit;

    beforeEach(() => {
      mockGetAbsolutePath.mockImplementation(({ path, dirPath }) =>
        Effect.succeed(`${dirPath}/${path}`)
      );
      mockEnsureDirectory.mockReturnValue(Effect.succeed(undefined));
      mockWriteFile.mockReturnValue(Effect.succeed(undefined));
      vi.mocked(git.add).mockResolvedValue(undefined);
      mockCommit.mockResolvedValue(restoreCommitOid);
    });

    it('restores readable assets and reports those that are missing or unreadable', async () => {
      mockExtractLocalAssetReferences.mockReturnValue(
        Effect.succeed([
          'assets/present.png',
          'assets/missing.png',
          'assets/corrupt.png',
        ])
      );
      vi.mocked(git.readBlob).mockImplementation(async ({ filepath }) => {
        if (filepath === 'assets/missing.png') {
          throw new git.Errors.NotFoundError('not found');
        }
        if (filepath === 'assets/corrupt.png') {
          throw new Error('corrupt object');
        }
        return { oid: sourceCommitOid, blob: new Uint8Array([1, 2, 3]) };
      });

      const result = await Effect.runPromise(
        store.restoreDocumentChanges({
          projectId: PROJECT_PATH,
          documentId: docId,
          commit,
        })
      );

      expect(result.commitId).toBe(restoreCommitOid);
      expect(result.skippedAssetPaths).toEqual([
        'assets/missing.png',
        'assets/corrupt.png',
      ]);
      const writtenPaths = mockWriteFile.mock.calls.map(([args]) => args.path);
      expect(writtenPaths).toContain(`${PROJECT_PATH}/${docPath}`);
      expect(writtenPaths).toContain(`${PROJECT_PATH}/assets/present.png`);
      expect(writtenPaths).not.toContain(`${PROJECT_PATH}/assets/corrupt.png`);
      expect(mockCommit).toHaveBeenCalled();
    });

    it('aborts when the document blob itself cannot be read', async () => {
      vi.mocked(git.readBlob).mockRejectedValue(new Error('doc read failed'));

      const error = await Effect.runPromise(
        store
          .restoreDocumentChanges({
            projectId: PROJECT_PATH,
            documentId: docId,
            commit,
          })
          .pipe(Effect.flip)
      );

      expect(error._tag).toBe(VersionedProjectRepositoryErrorTag);
      expect(mockCommit).not.toHaveBeenCalled();
    });
  });
});
