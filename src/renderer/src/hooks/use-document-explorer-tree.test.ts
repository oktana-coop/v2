import { describe, expect, it } from 'vitest';

import { filesystemItemTypes } from '../../../modules/infrastructure/filesystem';
import {
  type ExplorerTreeNode,
  getOpenableDocuments,
} from './use-document-explorer-tree';

const file = ({
  id,
  name,
}: {
  id: string;
  name: string;
}): ExplorerTreeNode => ({
  id,
  name,
  type: filesystemItemTypes.FILE,
});

const directory = ({
  id,
  name,
  children,
}: {
  id: string;
  name: string;
  children: ExplorerTreeNode[];
}): ExplorerTreeNode => ({
  id,
  name,
  type: filesystemItemTypes.DIRECTORY,
  children,
});

describe('getOpenableDocuments', () => {
  it('keeps files with a supported (document) extension', () => {
    const tree = [file({ id: 'notes.md', name: 'notes.md' })];

    expect(getOpenableDocuments(tree)).toEqual([
      file({ id: 'notes.md', name: 'notes.md' }),
    ]);
  });

  it('drops files with an unsupported extension', () => {
    const tree = [
      file({ id: 'notes.md', name: 'notes.md' }),
      file({ id: 'image.png', name: 'image.png' }),
      file({ id: 'archive.pdf', name: 'archive.pdf' }),
    ];

    expect(getOpenableDocuments(tree)).toEqual([
      file({ id: 'notes.md', name: 'notes.md' }),
    ]);
  });

  it('drops directory nodes while surfacing their openable children', () => {
    const tree = [
      file({ id: 'readme.md', name: 'readme.md' }),
      directory({
        id: 'docs',
        name: 'docs',
        children: [
          file({ id: 'docs/guide.md', name: 'guide.md' }),
          file({ id: 'docs/logo.svg', name: 'logo.svg' }),
        ],
      }),
    ];

    expect(getOpenableDocuments(tree)).toEqual([
      file({ id: 'readme.md', name: 'readme.md' }),
      file({ id: 'docs/guide.md', name: 'guide.md' }),
    ]);
  });

  it('descends into deeply nested directories', () => {
    const tree = [
      directory({
        id: 'a',
        name: 'a',
        children: [
          directory({
            id: 'a/b',
            name: 'b',
            children: [
              file({ id: 'a/b/deep.md', name: 'deep.md' }),
              file({ id: 'a/b/skip.txt', name: 'skip.txt' }),
            ],
          }),
        ],
      }),
    ];

    expect(getOpenableDocuments(tree)).toEqual([
      file({ id: 'a/b/deep.md', name: 'deep.md' }),
    ]);
  });

  it('handles empty input and childless directories without throwing', () => {
    expect(getOpenableDocuments([])).toEqual([]);
    expect(
      getOpenableDocuments([
        directory({ id: 'empty', name: 'empty', children: [] }),
      ])
    ).toEqual([]);
  });
});
