import { describe, expect, it } from 'vitest';

import {
  type ArtifactTreeNode,
  parseProjectRelPath,
} from '../../../../../../modules/domain/project';
import { filesystemItemTypes } from '../../../../../../modules/infrastructure/filesystem';
import { type ArtifactId } from '../../../../../../modules/infrastructure/version-control';
import {
  getExplorerTreeInProject,
  injectPendingDirectoryNode,
} from './explorer-tree';
import { type ExplorerTreeNode, NEW_DIRECTORY_NODE_ID } from './tree/types';

const basename = (path: string) => path.split('/').pop() ?? path;

// ArtifactTreeNode fixtures (input to getExplorerTreeInProject)
const artifactFile = (path: string): ArtifactTreeNode => ({
  id: path as ArtifactId,
  path: parseProjectRelPath(path),
  name: basename(path),
  type: filesystemItemTypes.FILE,
});

const artifactDir = ({
  path,
  children,
}: {
  path: string;
  children: ArtifactTreeNode[];
}): ArtifactTreeNode => ({
  id: path as ArtifactId,
  path: parseProjectRelPath(path),
  name: basename(path),
  type: filesystemItemTypes.DIRECTORY,
  children,
});

const dirNode = ({
  id,
  children,
}: {
  id: string;
  children?: ExplorerTreeNode[];
}): ExplorerTreeNode => ({
  id,
  name: basename(id),
  type: filesystemItemTypes.DIRECTORY,
  ...(children ? { children } : {}),
});

const pendingNode: ExplorerTreeNode = {
  id: NEW_DIRECTORY_NODE_ID,
  name: '',
  type: filesystemItemTypes.DIRECTORY,
  children: [],
};

describe('getExplorerTreeInProject', () => {
  it('returns an empty tree for an empty project', () => {
    expect(getExplorerTreeInProject([])).toEqual([]);
  });

  it('maps files to explorer nodes keyed by their path', () => {
    expect(
      getExplorerTreeInProject([artifactFile('a.md'), artifactFile('b.md')])
    ).toEqual([
      { id: 'a.md', name: 'a.md', type: filesystemItemTypes.FILE },
      { id: 'b.md', name: 'b.md', type: filesystemItemTypes.FILE },
    ]);
  });

  it('maps a directory and its children', () => {
    expect(
      getExplorerTreeInProject([
        artifactDir({ path: 'dir', children: [artifactFile('dir/a.md')] }),
      ])
    ).toEqual([
      {
        id: 'dir',
        name: 'dir',
        type: filesystemItemTypes.DIRECTORY,
        children: [
          { id: 'dir/a.md', name: 'a.md', type: filesystemItemTypes.FILE },
        ],
      },
    ]);
  });

  it('maps nested directories recursively', () => {
    expect(
      getExplorerTreeInProject([
        artifactDir({
          path: 'dir',
          children: [
            artifactDir({
              path: 'dir/sub',
              children: [artifactFile('dir/sub/a.md')],
            }),
          ],
        }),
      ])
    ).toEqual([
      {
        id: 'dir',
        name: 'dir',
        type: filesystemItemTypes.DIRECTORY,
        children: [
          {
            id: 'dir/sub',
            name: 'sub',
            type: filesystemItemTypes.DIRECTORY,
            children: [
              {
                id: 'dir/sub/a.md',
                name: 'a.md',
                type: filesystemItemTypes.FILE,
              },
            ],
          },
        ],
      },
    ]);
  });
});

const fileNode = (id: string): ExplorerTreeNode => ({
  id,
  name: basename(id),
  type: filesystemItemTypes.FILE,
});

describe('injectPendingDirectoryNode', () => {
  it('prepends the pending node at the root when no parent path is given', () => {
    expect(injectPendingDirectoryNode([fileNode('a.md')])).toEqual([
      pendingNode,
      fileNode('a.md'),
    ]);
  });

  it('injects the pending node as the first child of a top-level directory', () => {
    expect(
      injectPendingDirectoryNode(
        [dirNode({ id: 'dir', children: [fileNode('dir/a.md')] })],
        'dir'
      )
    ).toEqual([
      {
        id: 'dir',
        name: 'dir',
        type: filesystemItemTypes.DIRECTORY,
        children: [pendingNode, fileNode('dir/a.md')],
      },
    ]);
  });

  it('injects the pending node into a nested directory', () => {
    expect(
      injectPendingDirectoryNode(
        [
          dirNode({
            id: 'dir',
            children: [
              dirNode({
                id: 'dir/sub',
                children: [fileNode('dir/sub/a.md')],
              }),
            ],
          }),
        ],
        'dir/sub'
      )
    ).toEqual([
      {
        id: 'dir',
        name: 'dir',
        type: filesystemItemTypes.DIRECTORY,
        children: [
          {
            id: 'dir/sub',
            name: 'sub',
            type: filesystemItemTypes.DIRECTORY,
            children: [pendingNode, fileNode('dir/sub/a.md')],
          },
        ],
      },
    ]);
  });

  it('injects into an empty directory that has no children field', () => {
    expect(injectPendingDirectoryNode([dirNode({ id: 'dir' })], 'dir')).toEqual(
      [
        {
          id: 'dir',
          name: 'dir',
          type: filesystemItemTypes.DIRECTORY,
          children: [pendingNode],
        },
      ]
    );
  });

  it('leaves the tree unchanged when the parent path matches nothing', () => {
    const nodes = [dirNode({ id: 'dir', children: [fileNode('dir/a.md')] })];
    expect(injectPendingDirectoryNode(nodes, 'nonexistent')).toEqual(nodes);
  });
});
