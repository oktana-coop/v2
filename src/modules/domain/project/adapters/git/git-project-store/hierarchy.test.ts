import * as Effect from 'effect/Effect';
import git from 'isomorphic-git';

import {
  type Directory,
  type File,
  filesystemItemTypes,
} from '../../../../../infrastructure/filesystem';
import { VersionedProjectRepositoryErrorTag } from '../../../errors';
import {
  buildTestStore,
  mockListDirectoryTree,
  PROJECT_PATH,
} from './test-utils';

// getProjectTree resolves the current branch via git.currentBranch; everything
// else (ref construction, path parsing) runs for real so ids are concrete.
vi.mock('isomorphic-git', () => ({
  default: {
    currentBranch: vi.fn(),
  },
}));

const mockCurrentBranch = vi.mocked(git.currentBranch);

const store = buildTestStore();

const file = (path: string, name: string): File => ({
  type: filesystemItemTypes.FILE,
  path,
  name,
});

const directory = (
  path: string,
  name: string,
  children: Array<Directory | File>
): Directory => ({
  type: filesystemItemTypes.DIRECTORY,
  path,
  name,
  permissionState: 'granted',
  children,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCurrentBranch.mockResolvedValue('main');
});

describe('getProjectTree', () => {
  it('maps files to blob-ref artifact nodes', async () => {
    mockListDirectoryTree.mockReturnValue(
      Effect.succeed([file('readme.md', 'readme.md')])
    );

    const tree = await Effect.runPromise(store.getProjectTree(PROJECT_PATH));

    expect(tree).toEqual([
      {
        id: '/blob/main/readme.md',
        name: 'readme.md',
        path: 'readme.md',
        type: filesystemItemTypes.FILE,
      },
    ]);
  });

  it('maps directories to tree-ref nodes with recursively mapped children', async () => {
    mockListDirectoryTree.mockReturnValue(
      Effect.succeed([
        file('readme.md', 'readme.md'),
        directory('docs', 'docs', [
          file('docs/guide.md', 'guide.md'),
          directory('docs/2024', '2024', [
            file('docs/2024/notes.md', 'notes.md'),
          ]),
        ]),
      ])
    );

    const tree = await Effect.runPromise(store.getProjectTree(PROJECT_PATH));

    expect(tree).toEqual([
      {
        id: '/blob/main/readme.md',
        name: 'readme.md',
        path: 'readme.md',
        type: filesystemItemTypes.FILE,
      },
      {
        id: '/tree/main/docs',
        name: 'docs',
        path: 'docs',
        type: filesystemItemTypes.DIRECTORY,
        children: [
          {
            id: '/blob/main/docs/guide.md',
            name: 'guide.md',
            path: 'docs/guide.md',
            type: filesystemItemTypes.FILE,
          },
          {
            id: '/tree/main/docs/2024',
            name: '2024',
            path: 'docs/2024',
            type: filesystemItemTypes.DIRECTORY,
            children: [
              {
                id: '/blob/main/docs/2024/notes.md',
                name: 'notes.md',
                path: 'docs/2024/notes.md',
                type: filesystemItemTypes.FILE,
              },
            ],
          },
        ],
      },
    ]);
  });

  it('represents an empty directory with an empty children array', async () => {
    mockListDirectoryTree.mockReturnValue(
      Effect.succeed([directory('empty', 'empty', [])])
    );

    const tree = await Effect.runPromise(store.getProjectTree(PROJECT_PATH));

    expect(tree).toEqual([
      {
        id: '/tree/main/empty',
        name: 'empty',
        path: 'empty',
        type: filesystemItemTypes.DIRECTORY,
        children: [],
      },
    ]);
  });

  it('returns an empty tree for an empty project', async () => {
    mockListDirectoryTree.mockReturnValue(Effect.succeed([]));

    const tree = await Effect.runPromise(store.getProjectTree(PROJECT_PATH));

    expect(tree).toEqual([]);
  });

  it('reflects the current branch in artifact ids', async () => {
    mockCurrentBranch.mockResolvedValue('feature');
    mockListDirectoryTree.mockReturnValue(
      Effect.succeed([
        file('readme.md', 'readme.md'),
        directory('docs', 'docs', []),
      ])
    );

    const tree = await Effect.runPromise(store.getProjectTree(PROJECT_PATH));

    expect(tree[0].id).toBe('/blob/feature/readme.md');
    expect(tree[1].id).toBe('/tree/feature/docs');
  });

  it('maps a directory-listing failure to a RepositoryError', async () => {
    mockListDirectoryTree.mockReturnValue(Effect.fail(new Error('disk error')));

    const result = await Effect.runPromise(
      Effect.either(store.getProjectTree(PROJECT_PATH))
    );

    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe(VersionedProjectRepositoryErrorTag);
    }
  });
});
