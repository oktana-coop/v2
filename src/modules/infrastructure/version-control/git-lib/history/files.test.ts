import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import { documentChangeTypes } from '../../models';
import {
  fileExistsAtCommit,
  getChangedFilesForCommit,
  getUncommittedFileChanges,
} from './files';

vi.mock('isomorphic-git', () => ({
  default: {
    walk: vi.fn(),
    readCommit: vi.fn(),
    statusMatrix: vi.fn(),
    readBlob: vi.fn(),
    TREE: vi.fn((args) => args),
  },
}));

const mockFs = {} as IsoGitFsApi;
const dir = '/test-repo';

const mockWalk = vi.mocked(git.walk);
const mockReadCommit = vi.mocked(git.readCommit);
const mockStatusMatrix = vi.mocked(git.statusMatrix);
const mockReadBlob = vi.mocked(git.readBlob);

// --- git.walk mock helpers ---
//
// In the production code, `getFilesAtRef` calls `git.walk({ map: ... })` with
// a `map` callback that filters out non-blob entries. Since `git.walk` is
// mocked, we need to invoke that callback ourselves so we can test the
// filtering logic. The mock captures the `map` function from the call args
// and feeds it our test entries.

type WalkEntry = { filepath: string; type: string; oid: string };

/** Creates a minimal mock of the entry object that git.walk passes to `map`. */
const toWalkEntryObject = (entry: WalkEntry) => ({
  type: () => Promise.resolve(entry.type),
  oid: () => Promise.resolve(entry.oid),
});

/**
 * Invokes a git.walk `map` callback against a list of entries and returns
 * only the non-undefined results. The root entry (".") is always prepended
 * since git.walk always visits it first. Subdirectory and submodule entries
 * can be included in `entries` when testing that our callback filters them out.
 */
const applyMapCallback = async (
  map: NonNullable<Parameters<typeof git.walk>[0]['map']>,
  entries: WalkEntry[]
) => {
  const rootEntry: WalkEntry = { filepath: '.', type: 'tree', oid: '' };
  const all = [rootEntry, ...entries];
  const results = await Promise.all(
    all.map((entry) => map(entry.filepath, [toWalkEntryObject(entry) as never]))
  );
  return results.filter((r) => r !== undefined);
};

/**
 * Configures the git.walk mock so that each call looks up entries by git ref
 * and runs the production `map` callback against them.
 */
const setupWalkForRefs = (trees: Record<string, WalkEntry[]>) => {
  mockWalk.mockImplementation(async (args) => {
    // Our mock for git.TREE passes args through, so trees[0] is { ref: '...' }
    const ref = (args.trees[0] as unknown as { ref: string }).ref;
    // Invoke the real map callback so our filtering logic is exercised
    return applyMapCallback(args.map!, trees[ref] ?? []);
  });
};

const makeCommitResult = (parentOids: string[]) =>
  ({
    commit: { parent: parentOids },
  }) as Awaited<ReturnType<typeof git.readCommit>>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getChangedFilesForCommit', () => {
  const commitId = 'abc123' as Parameters<
    typeof getChangedFilesForCommit
  >[0]['commitId'];

  describe('initial commit (no parents)', () => {
    it('marks all files as added', async () => {
      mockReadCommit.mockResolvedValue(makeCommitResult([]));
      setupWalkForRefs({
        [commitId]: [
          { filepath: 'readme.md', type: 'blob', oid: 'aaa' },
          { filepath: 'src/index.ts', type: 'blob', oid: 'bbb' },
        ],
      });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual([
        { path: 'readme.md', changeType: documentChangeTypes.ADDED },
        { path: 'src/index.ts', changeType: documentChangeTypes.ADDED },
      ]);
    });

    it('skips directories and submodules', async () => {
      mockReadCommit.mockResolvedValue(makeCommitResult([]));
      setupWalkForRefs({
        [commitId]: [
          { filepath: 'src', type: 'tree', oid: '000' },
          { filepath: 'submodule', type: 'commit', oid: '111' },
          { filepath: 'readme.md', type: 'blob', oid: 'aaa' },
        ],
      });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual([
        { path: 'readme.md', changeType: documentChangeTypes.ADDED },
      ]);
    });

    it('returns empty array for empty initial commit', async () => {
      mockReadCommit.mockResolvedValue(makeCommitResult([]));
      setupWalkForRefs({ [commitId]: [] });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual([]);
    });
  });

  describe('commit with parent', () => {
    const parentOid = 'parent123';

    it('detects added files', async () => {
      mockReadCommit.mockResolvedValue(makeCommitResult([parentOid]));
      setupWalkForRefs({
        [parentOid]: [{ filepath: 'existing.md', type: 'blob', oid: 'aaa' }],
        [commitId]: [
          { filepath: 'existing.md', type: 'blob', oid: 'aaa' },
          { filepath: 'new-file.md', type: 'blob', oid: 'bbb' },
        ],
      });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual([
        { path: 'new-file.md', changeType: documentChangeTypes.ADDED },
      ]);
    });

    it('detects deleted files', async () => {
      mockReadCommit.mockResolvedValue(makeCommitResult([parentOid]));
      setupWalkForRefs({
        [parentOid]: [
          { filepath: 'kept.md', type: 'blob', oid: 'aaa' },
          { filepath: 'removed.md', type: 'blob', oid: 'bbb' },
        ],
        [commitId]: [{ filepath: 'kept.md', type: 'blob', oid: 'aaa' }],
      });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual([
        { path: 'removed.md', changeType: documentChangeTypes.DELETED },
      ]);
    });

    it('detects modified files', async () => {
      mockReadCommit.mockResolvedValue(makeCommitResult([parentOid]));
      setupWalkForRefs({
        [parentOid]: [{ filepath: 'file.md', type: 'blob', oid: 'aaa' }],
        [commitId]: [{ filepath: 'file.md', type: 'blob', oid: 'bbb' }],
      });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual([
        { path: 'file.md', changeType: documentChangeTypes.MODIFIED },
      ]);
    });

    it('detects renamed files (same oid, different path)', async () => {
      mockReadCommit.mockResolvedValue(makeCommitResult([parentOid]));
      setupWalkForRefs({
        [parentOid]: [{ filepath: 'old-name.md', type: 'blob', oid: 'aaa' }],
        [commitId]: [{ filepath: 'new-name.md', type: 'blob', oid: 'aaa' }],
      });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual([
        {
          path: 'new-name.md',
          changeType: documentChangeTypes.RENAMED,
          previousPath: 'old-name.md',
        },
      ]);
    });

    it('detects all change types in a single commit', async () => {
      mockReadCommit.mockResolvedValue(makeCommitResult([parentOid]));
      setupWalkForRefs({
        [parentOid]: [
          { filepath: 'unchanged.md', type: 'blob', oid: 'aaa' },
          { filepath: 'modified.md', type: 'blob', oid: 'bbb' },
          { filepath: 'deleted.md', type: 'blob', oid: 'ccc' },
          { filepath: 'old-name.md', type: 'blob', oid: 'ddd' },
        ],
        [commitId]: [
          { filepath: 'unchanged.md', type: 'blob', oid: 'aaa' },
          { filepath: 'modified.md', type: 'blob', oid: 'bbb-v2' },
          { filepath: 'added.md', type: 'blob', oid: 'eee' },
          { filepath: 'new-name.md', type: 'blob', oid: 'ddd' },
        ],
      });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual(
        expect.arrayContaining([
          { path: 'modified.md', changeType: documentChangeTypes.MODIFIED },
          {
            path: 'new-name.md',
            changeType: documentChangeTypes.RENAMED,
            previousPath: 'old-name.md',
          },
          { path: 'added.md', changeType: documentChangeTypes.ADDED },
          { path: 'deleted.md', changeType: documentChangeTypes.DELETED },
        ])
      );
      expect(result).toHaveLength(4);
    });

    it('does not report unchanged files', async () => {
      mockReadCommit.mockResolvedValue(makeCommitResult([parentOid]));
      setupWalkForRefs({
        [parentOid]: [
          { filepath: 'file-a.md', type: 'blob', oid: 'aaa' },
          { filepath: 'file-b.md', type: 'blob', oid: 'bbb' },
        ],
        [commitId]: [
          { filepath: 'file-a.md', type: 'blob', oid: 'aaa' },
          { filepath: 'file-b.md', type: 'blob', oid: 'bbb' },
        ],
      });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual([]);
    });

    it('uses first parent for merge commits', async () => {
      const secondParent = 'parent456';
      mockReadCommit.mockResolvedValue(
        makeCommitResult([parentOid, secondParent])
      );
      setupWalkForRefs({
        [parentOid]: [{ filepath: 'file.md', type: 'blob', oid: 'aaa' }],
        [commitId]: [
          { filepath: 'file.md', type: 'blob', oid: 'aaa' },
          { filepath: 'merged.md', type: 'blob', oid: 'bbb' },
        ],
      });

      const result = await Effect.runPromise(
        getChangedFilesForCommit({ isoGitFs: mockFs, dir, commitId })
      );

      expect(result).toEqual([
        { path: 'merged.md', changeType: documentChangeTypes.ADDED },
      ]);
      // Verify only first parent was walked (not second)
      const walkedRefs = mockWalk.mock.calls.map(
        (call) => (call[0].trees[0] as unknown as { ref: string }).ref
      );
      expect(walkedRefs).not.toContain(secondParent);
    });
  });
});

describe('getUncommittedFileChanges', () => {
  it('detects added files', async () => {
    mockStatusMatrix.mockResolvedValue([['new-file.md', 0, 2, 0]]);

    const result = await Effect.runPromise(
      getUncommittedFileChanges({ isoGitFs: mockFs, dir })
    );

    expect(result).toEqual([
      { path: 'new-file.md', changeType: documentChangeTypes.ADDED },
    ]);
  });

  it('detects deleted files', async () => {
    mockStatusMatrix.mockResolvedValue([['removed.md', 1, 0, 0]]);

    const result = await Effect.runPromise(
      getUncommittedFileChanges({ isoGitFs: mockFs, dir })
    );

    expect(result).toEqual([
      { path: 'removed.md', changeType: documentChangeTypes.DELETED },
    ]);
  });

  it('detects modified files', async () => {
    mockStatusMatrix.mockResolvedValue([['changed.md', 1, 2, 0]]);

    const result = await Effect.runPromise(
      getUncommittedFileChanges({ isoGitFs: mockFs, dir })
    );

    expect(result).toEqual([
      { path: 'changed.md', changeType: documentChangeTypes.MODIFIED },
    ]);
  });

  it('skips unchanged files', async () => {
    mockStatusMatrix.mockResolvedValue([['unchanged.md', 1, 1, 1]]);

    const result = await Effect.runPromise(
      getUncommittedFileChanges({ isoGitFs: mockFs, dir })
    );

    expect(result).toEqual([]);
  });

  it('handles multiple changes', async () => {
    mockStatusMatrix.mockResolvedValue([
      ['added.md', 0, 2, 0],
      ['unchanged.md', 1, 1, 1],
      ['modified.md', 1, 2, 2],
      ['deleted.md', 1, 0, 0],
    ]);

    const result = await Effect.runPromise(
      getUncommittedFileChanges({ isoGitFs: mockFs, dir })
    );

    expect(result).toEqual([
      { path: 'added.md', changeType: documentChangeTypes.ADDED },
      { path: 'modified.md', changeType: documentChangeTypes.MODIFIED },
      { path: 'deleted.md', changeType: documentChangeTypes.DELETED },
    ]);
  });

  it('returns empty array for clean working directory', async () => {
    mockStatusMatrix.mockResolvedValue([]);

    const result = await Effect.runPromise(
      getUncommittedFileChanges({ isoGitFs: mockFs, dir })
    );

    expect(result).toEqual([]);
  });
});

describe('fileExistsAtCommit', () => {
  const commitId = 'abc123' as Parameters<
    typeof fileExistsAtCommit
  >[0]['commitId'];

  it('succeeds when the file exists', async () => {
    mockReadBlob.mockResolvedValue({ oid: 'aaa', blob: new Uint8Array() });

    await expect(
      Effect.runPromise(
        fileExistsAtCommit({
          isoGitFs: mockFs,
          dir,
          commitId,
          filepath: 'readme.md',
        })
      )
    ).resolves.toBeUndefined();
  });

  it('fails with NotFoundError when the file does not exist', async () => {
    const notFoundError = new Error('File not found');
    notFoundError.name = 'NotFoundError';
    mockReadBlob.mockRejectedValue(notFoundError);

    const error = await Effect.runPromise(
      Effect.flip(
        fileExistsAtCommit({
          isoGitFs: mockFs,
          dir,
          commitId,
          filepath: 'missing.md',
        })
      )
    );

    expect(error._tag).toBe('VersionControlNotFoundError');
  });

  it('fails with RepositoryError for other git errors', async () => {
    mockReadBlob.mockRejectedValue(new Error('Git error'));

    const error = await Effect.runPromise(
      Effect.flip(
        fileExistsAtCommit({
          isoGitFs: mockFs,
          dir,
          commitId,
          filepath: 'file.md',
        })
      )
    );

    expect(error._tag).toBe('VersionControlRepositoryError');
  });
});
