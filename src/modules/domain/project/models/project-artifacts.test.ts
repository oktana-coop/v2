import { describe, expect, it } from 'vitest';

import { filesystemItemTypes } from '../../../infrastructure/filesystem';
import { type ArtifactId } from '../../../infrastructure/version-control';
import {
  findFileNodeByPath,
  findNodeById,
  inferArtifactKindFromExtension,
  listOpenableArtifacts,
  type ProjectDirectoryNode,
  type ProjectFileNode,
  type ProjectTreeNode,
} from './project-artifacts';
import { parseProjectRelPath } from './project-rel-path';

const file = ({ path }: { path: string }): ProjectFileNode => ({
  id: path as ArtifactId,
  path: parseProjectRelPath(path),
  kind: inferArtifactKindFromExtension(path),
  filesystemType: filesystemItemTypes.FILE,
});

const directory = ({
  path,
  children,
}: {
  path: string;
  children: ProjectTreeNode[];
}): ProjectDirectoryNode => ({
  path: parseProjectRelPath(path),
  filesystemType: filesystemItemTypes.DIRECTORY,
  children,
});

describe('listOpenableArtifacts', () => {
  it('keeps files with a supported (document) extension', () => {
    const tree = [file({ path: 'notes.md' })];

    expect(listOpenableArtifacts(tree)).toEqual([file({ path: 'notes.md' })]);
  });

  it('drops files with an unsupported extension', () => {
    const tree = [
      file({ path: 'notes.md' }),
      file({ path: 'image.png' }),
      file({ path: 'archive.pdf' }),
    ];

    expect(listOpenableArtifacts(tree)).toEqual([file({ path: 'notes.md' })]);
  });

  it('drops directory nodes while surfacing their openable children', () => {
    const tree = [
      file({ path: 'readme.md' }),
      directory({
        path: 'docs',
        children: [
          file({ path: 'docs/guide.md' }),
          file({ path: 'docs/logo.svg' }),
        ],
      }),
    ];

    expect(listOpenableArtifacts(tree)).toEqual([
      file({ path: 'readme.md' }),
      file({ path: 'docs/guide.md' }),
    ]);
  });

  it('descends into deeply nested directories', () => {
    const tree = [
      directory({
        path: 'a',
        children: [
          directory({
            path: 'a/b',
            children: [
              file({ path: 'a/b/deep.md' }),
              file({ path: 'a/b/skip.txt' }),
            ],
          }),
        ],
      }),
    ];

    expect(listOpenableArtifacts(tree)).toEqual([
      file({ path: 'a/b/deep.md' }),
    ]);
  });

  it('handles empty input and childless directories without throwing', () => {
    expect(listOpenableArtifacts([])).toEqual([]);
    expect(
      listOpenableArtifacts([directory({ path: 'empty', children: [] })])
    ).toEqual([]);
  });
});

const tree: ProjectTreeNode[] = [
  file({ path: 'readme.md' }),
  directory({
    path: 'docs',
    children: [
      file({ path: 'docs/guide.md' }),
      directory({
        path: 'docs/2024',
        children: [file({ path: 'docs/2024/notes.md' })],
      }),
    ],
  }),
];

describe('findFileNodeByPath', () => {
  it('finds a file at the root', () => {
    expect(
      findFileNodeByPath({ tree, path: parseProjectRelPath('readme.md') })
    ).toBe(tree[0]);
  });

  it('finds a deeply nested file', () => {
    expect(
      findFileNodeByPath({
        tree,
        path: parseProjectRelPath('docs/2024/notes.md'),
      })?.path
    ).toBe('docs/2024/notes.md');
  });

  // Directories aren't tracked artifacts, so there is nothing to hand back.
  it('returns null for a directory path', () => {
    expect(
      findFileNodeByPath({ tree, path: parseProjectRelPath('docs') })
    ).toBeNull();
  });

  it('returns null when the path is absent', () => {
    expect(
      findFileNodeByPath({ tree, path: parseProjectRelPath('docs/missing.md') })
    ).toBeNull();
  });

  it('returns null for an empty tree', () => {
    expect(
      findFileNodeByPath({ tree: [], path: parseProjectRelPath('readme.md') })
    ).toBeNull();
  });
});

describe('findNodeById', () => {
  it('finds a deeply nested file by its artifact id', () => {
    expect(
      findNodeById({ tree, id: 'docs/2024/notes.md' as ArtifactId })?.path
    ).toBe('docs/2024/notes.md');
  });

  it('returns null when no file carries the id', () => {
    expect(
      findNodeById({ tree, id: 'docs/absent.md' as ArtifactId })
    ).toBeNull();
  });

  // A directory path can never resolve to an artifact, even though the
  // explorer keys directory nodes by that same path.
  it('returns null for a path that belongs to a directory', () => {
    expect(findNodeById({ tree, id: 'docs' as ArtifactId })).toBeNull();
  });
});
