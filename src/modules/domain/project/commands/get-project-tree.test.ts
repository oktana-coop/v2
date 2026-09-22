import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { filesystemItemTypes } from '../../../../modules/infrastructure/filesystem';
import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import {
  inferArtifactKindFromExtension,
  parseProjectRelPath,
  type ProjectId,
  type ProjectStoreDirectoryNode,
  type ProjectStoreFileNode,
} from '../models';
import { getProjectTree, markSharedDocuments } from './get-project-tree';

const projectId = '/projects/one' as ProjectId;
const branch = 'main' as Branch;

const file = (path: string): ProjectStoreFileNode => ({
  id: path as ArtifactId,
  path: parseProjectRelPath(path),
  kind: inferArtifactKindFromExtension(path),
  filesystemType: filesystemItemTypes.FILE,
});

const directory = (
  path: string,
  children: ProjectStoreDirectoryNode['children']
): ProjectStoreDirectoryNode => ({
  path: parseProjectRelPath(path),
  filesystemType: filesystemItemTypes.DIRECTORY,
  children,
});

describe('markSharedDocuments', () => {
  it('marks each document by what the predicate says of it', () => {
    expect(
      markSharedDocuments({
        tree: [file('a.md'), file('b.md')],
        isShared: (node) => node.id === 'a.md',
      })
    ).toEqual([
      { ...file('a.md'), shared: true },
      { ...file('b.md'), shared: false },
    ]);
  });

  it('reaches documents inside directories', () => {
    expect(
      markSharedDocuments({
        tree: [directory('dir', [file('dir/a.md')])],
        isShared: () => true,
      })
    ).toEqual([
      {
        ...directory('dir', []),
        children: [{ ...file('dir/a.md'), shared: true }],
      },
    ]);
  });
});

describe('getProjectTree', () => {
  const tree = ({
    sharedOn,
    branch,
  }: {
    sharedOn: Branch | null;
    branch: Branch | null;
  }) =>
    Effect.runPromise(
      getProjectTree({
        getProjectStoreTree: () => Effect.succeed([file('a.md'), file('b.md')]),
        isShared: (key) => key.documentId === 'a.md' && key.branch === sharedOn,
      })({ projectId, branch })
    );

  it('marks the documents shared on the branch', async () => {
    expect(await tree({ sharedOn: branch, branch })).toEqual([
      { ...file('a.md'), shared: true },
      { ...file('b.md'), shared: false },
    ]);
  });

  it('marks nothing while the branch is not known', async () => {
    expect(await tree({ sharedOn: branch, branch: null })).toEqual([
      { ...file('a.md'), shared: false },
      { ...file('b.md'), shared: false },
    ]);
  });
});
