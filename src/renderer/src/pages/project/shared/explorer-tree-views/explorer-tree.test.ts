import { describe, expect, it } from 'vitest';

import {
  inferArtifactKindFromExtension,
  parseProjectRelPath,
  type ProjectDirectoryNode,
  type ProjectFileNode,
  type ProjectTreeNode,
} from '../../../../../../modules/domain/project';
import { filesystemEntryTypes } from '../../../../../../modules/infrastructure/filesystem';
import { type ArtifactId } from '../../../../../../modules/infrastructure/version-control';
import { getExplorerTreeInProject, injectPendingNode } from './explorer-tree';
import {
  type ExplorerTreeNode,
  NEW_DIRECTORY_NODE_ID,
  NEW_FILE_NODE_ID,
  type PendingTreeEntry,
} from './tree/types';

const basename = (path: string) => path.split('/').pop() ?? path;

// ProjectTreeNode fixtures (input to getExplorerTreeInProject)
const artifactFile = (path: string): ProjectFileNode => ({
  id: path as ArtifactId,
  path: parseProjectRelPath(path),
  kind: inferArtifactKindFromExtension(path),
  filesystemType: filesystemEntryTypes.FILE,
  shared: false,
});

const artifactDir = ({
  path,
  children,
}: {
  path: string;
  children: ProjectTreeNode[];
}): ProjectDirectoryNode => ({
  path: parseProjectRelPath(path),
  filesystemType: filesystemEntryTypes.DIRECTORY,
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
  type: filesystemEntryTypes.DIRECTORY,
  shared: false,
  ...(children ? { children } : {}),
});

const pendingDirectoryNode: ExplorerTreeNode = {
  id: NEW_DIRECTORY_NODE_ID,
  name: '',
  type: filesystemEntryTypes.DIRECTORY,
  shared: false,
  children: [],
};

const pendingFileNode: ExplorerTreeNode = {
  id: NEW_FILE_NODE_ID,
  name: '',
  type: filesystemEntryTypes.FILE,
  shared: false,
};

describe('getExplorerTreeInProject', () => {
  it('returns an empty tree for an empty project', () => {
    expect(getExplorerTreeInProject([])).toEqual([]);
  });

  it('maps files to explorer nodes keyed by their path', () => {
    expect(
      getExplorerTreeInProject([artifactFile('a.md'), artifactFile('b.md')])
    ).toEqual([
      {
        id: 'a.md',
        name: 'a.md',
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
      {
        id: 'b.md',
        name: 'b.md',
        type: filesystemEntryTypes.FILE,
        shared: false,
      },
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
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [
          {
            id: 'dir/a.md',
            name: 'a.md',
            type: filesystemEntryTypes.FILE,
            shared: false,
          },
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
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [
          {
            id: 'dir/sub',
            name: 'sub',
            type: filesystemEntryTypes.DIRECTORY,
            shared: false,
            children: [
              {
                id: 'dir/sub/a.md',
                name: 'a.md',
                type: filesystemEntryTypes.FILE,
                shared: false,
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
  type: filesystemEntryTypes.FILE,
  shared: false,
});

const pendingDirectory = (parentPath?: string): PendingTreeEntry => ({
  type: filesystemEntryTypes.DIRECTORY,
  parentPath,
});

const pendingFile = (parentPath?: string): PendingTreeEntry => ({
  type: filesystemEntryTypes.FILE,
  parentPath,
});

describe('injectPendingNode', () => {
  it('prepends the pending node at the root when no parent path is given', () => {
    expect(injectPendingNode([fileNode('a.md')], pendingDirectory())).toEqual([
      pendingDirectoryNode,
      fileNode('a.md'),
    ]);
  });

  it('injects the pending node as the first child of a top-level directory', () => {
    expect(
      injectPendingNode(
        [dirNode({ id: 'dir', children: [fileNode('dir/a.md')] })],
        pendingDirectory('dir')
      )
    ).toEqual([
      {
        id: 'dir',
        name: 'dir',
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [pendingDirectoryNode, fileNode('dir/a.md')],
      },
    ]);
  });

  it('injects the pending node into a nested directory', () => {
    expect(
      injectPendingNode(
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
        pendingDirectory('dir/sub')
      )
    ).toEqual([
      {
        id: 'dir',
        name: 'dir',
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [
          {
            id: 'dir/sub',
            name: 'sub',
            type: filesystemEntryTypes.DIRECTORY,
            shared: false,
            children: [pendingDirectoryNode, fileNode('dir/sub/a.md')],
          },
        ],
      },
    ]);
  });

  it('injects into an empty directory that has no children field', () => {
    expect(
      injectPendingNode([dirNode({ id: 'dir' })], pendingDirectory('dir'))
    ).toEqual([
      {
        id: 'dir',
        name: 'dir',
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [pendingDirectoryNode],
      },
    ]);
  });

  it('leaves the tree unchanged when the parent path matches nothing', () => {
    const nodes = [dirNode({ id: 'dir', children: [fileNode('dir/a.md')] })];
    expect(injectPendingNode(nodes, pendingDirectory('nonexistent'))).toEqual(
      nodes
    );
  });

  it('prepends a pending file at the root when no parent path is given', () => {
    expect(injectPendingNode([fileNode('a.md')], pendingFile())).toEqual([
      pendingFileNode,
      fileNode('a.md'),
    ]);
  });

  it('injects a pending file into a nested directory', () => {
    expect(
      injectPendingNode(
        [
          dirNode({
            id: 'dir',
            children: [dirNode({ id: 'dir/sub' })],
          }),
        ],
        pendingFile('dir/sub')
      )
    ).toEqual([
      {
        id: 'dir',
        name: 'dir',
        type: filesystemEntryTypes.DIRECTORY,
        shared: false,
        children: [
          {
            id: 'dir/sub',
            name: 'sub',
            type: filesystemEntryTypes.DIRECTORY,
            shared: false,
            children: [pendingFileNode],
          },
        ],
      },
    ]);
  });

  it('gives an empty project a node to name the first file in', () => {
    expect(injectPendingNode([], pendingFile())).toEqual([pendingFileNode]);
  });

  it('gives the pending node the name its field starts with', () => {
    expect(
      injectPendingNode([], {
        type: filesystemEntryTypes.FILE,
        name: 'Untitled.md',
      })
    ).toEqual([{ ...pendingFileNode, name: 'Untitled.md' }]);
  });
});
