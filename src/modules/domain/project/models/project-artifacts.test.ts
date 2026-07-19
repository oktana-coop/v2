import { describe, expect, it } from 'vitest';

import { filesystemItemTypes } from '../../../infrastructure/filesystem';
import { type ArtifactId } from '../../../infrastructure/version-control';
import {
  type ArtifactTreeNode,
  findNodeByPath,
  inferArtifactKindFromExtension,
  listOpenableArtifacts,
} from './project-artifacts';
import { parseProjectRelPath } from './project-rel-path';

const file = ({ path }: { path: string }): ArtifactTreeNode => ({
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
  children: ArtifactTreeNode[];
}): ArtifactTreeNode => ({
  id: path as ArtifactId,
  path: parseProjectRelPath(path),
  kind: inferArtifactKindFromExtension(path),
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

describe('findNodeByPath', () => {
  const tree = [
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
        ?.path
    ).toBe('docs/2024/notes.md');
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
