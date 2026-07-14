import { describe, expect, it } from 'vitest';

import { filesystemItemTypes } from '../../../infrastructure/filesystem';
import { type ArtifactId } from '../../../infrastructure/version-control';
import {
  type ArtifactTreeNode,
  findNodeByPath,
  listOpenableArtifacts,
} from './project-artifacts';
import { parseProjectRelPath } from './project-rel-path';

const file = ({
  path,
  name,
}: {
  path: string;
  name: string;
}): ArtifactTreeNode => ({
  id: path as ArtifactId,
  path: parseProjectRelPath(path),
  name,
  type: filesystemItemTypes.FILE,
});

const directory = ({
  path,
  name,
  children,
}: {
  path: string;
  name: string;
  children: ArtifactTreeNode[];
}): ArtifactTreeNode => ({
  id: path as ArtifactId,
  path: parseProjectRelPath(path),
  name,
  type: filesystemItemTypes.DIRECTORY,
  children,
});

describe('listOpenableArtifacts', () => {
  it('keeps files with a supported (document) extension', () => {
    const tree = [file({ path: 'notes.md', name: 'notes.md' })];

    expect(listOpenableArtifacts(tree)).toEqual([
      file({ path: 'notes.md', name: 'notes.md' }),
    ]);
  });

  it('drops files with an unsupported extension', () => {
    const tree = [
      file({ path: 'notes.md', name: 'notes.md' }),
      file({ path: 'image.png', name: 'image.png' }),
      file({ path: 'archive.pdf', name: 'archive.pdf' }),
    ];

    expect(listOpenableArtifacts(tree)).toEqual([
      file({ path: 'notes.md', name: 'notes.md' }),
    ]);
  });

  it('drops directory nodes while surfacing their openable children', () => {
    const tree = [
      file({ path: 'readme.md', name: 'readme.md' }),
      directory({
        path: 'docs',
        name: 'docs',
        children: [
          file({ path: 'docs/guide.md', name: 'guide.md' }),
          file({ path: 'docs/logo.svg', name: 'logo.svg' }),
        ],
      }),
    ];

    expect(listOpenableArtifacts(tree)).toEqual([
      file({ path: 'readme.md', name: 'readme.md' }),
      file({ path: 'docs/guide.md', name: 'guide.md' }),
    ]);
  });

  it('descends into deeply nested directories', () => {
    const tree = [
      directory({
        path: 'a',
        name: 'a',
        children: [
          directory({
            path: 'a/b',
            name: 'b',
            children: [
              file({ path: 'a/b/deep.md', name: 'deep.md' }),
              file({ path: 'a/b/skip.txt', name: 'skip.txt' }),
            ],
          }),
        ],
      }),
    ];

    expect(listOpenableArtifacts(tree)).toEqual([
      file({ path: 'a/b/deep.md', name: 'deep.md' }),
    ]);
  });

  it('handles empty input and childless directories without throwing', () => {
    expect(listOpenableArtifacts([])).toEqual([]);
    expect(
      listOpenableArtifacts([
        directory({ path: 'empty', name: 'empty', children: [] }),
      ])
    ).toEqual([]);
  });
});

describe('findNodeByPath', () => {
  const tree = [
    file({ path: 'readme.md', name: 'readme.md' }),
    directory({
      path: 'docs',
      name: 'docs',
      children: [
        file({ path: 'docs/guide.md', name: 'guide.md' }),
        directory({
          path: 'docs/2024',
          name: '2024',
          children: [file({ path: 'docs/2024/notes.md', name: 'notes.md' })],
        }),
      ],
    }),
  ];

  it('finds a node at the root', () => {
    expect(
      findNodeByPath({ tree, path: parseProjectRelPath('readme.md') })
    ).toBe(tree[0]);
  });

  it('finds a directory node by its own path', () => {
    expect(findNodeByPath({ tree, path: parseProjectRelPath('docs') })).toBe(
      tree[1]
    );
  });

  it('finds a deeply nested node', () => {
    expect(
      findNodeByPath({ tree, path: parseProjectRelPath('docs/2024/notes.md') })
        ?.name
    ).toBe('notes.md');
  });

  it('returns null when the path is absent', () => {
    expect(
      findNodeByPath({ tree, path: parseProjectRelPath('docs/missing.md') })
    ).toBeNull();
  });

  it('returns null for an empty tree', () => {
    expect(
      findNodeByPath({ tree: [], path: parseProjectRelPath('readme.md') })
    ).toBeNull();
  });
});
