import { describe, expect, it } from 'vitest';

import { filesystemItemTypes } from '../../../modules/infrastructure/filesystem';
import {
  type ExplorerTreeNode,
  getOpenableDocuments,
} from './use-document-explorer-tree';

const file = (id: string, name: string): ExplorerTreeNode => ({
  id,
  name,
  type: filesystemItemTypes.FILE,
});

const directory = (
  id: string,
  name: string,
  children: ExplorerTreeNode[]
): ExplorerTreeNode => ({
  id,
  name,
  type: filesystemItemTypes.DIRECTORY,
  children,
});

describe('getOpenableDocuments', () => {
  it('keeps files with a supported (document) extension', () => {
    const tree = [file('notes.md', 'notes.md')];

    expect(getOpenableDocuments(tree)).toEqual([file('notes.md', 'notes.md')]);
  });

  it('drops files with an unsupported extension', () => {
    const tree = [
      file('notes.md', 'notes.md'),
      file('image.png', 'image.png'),
      file('archive.pdf', 'archive.pdf'),
    ];

    expect(getOpenableDocuments(tree)).toEqual([file('notes.md', 'notes.md')]);
  });

  it('drops directory nodes while surfacing their openable children', () => {
    const tree = [
      file('readme.md', 'readme.md'),
      directory('docs', 'docs', [
        file('docs/guide.md', 'guide.md'),
        file('docs/logo.svg', 'logo.svg'),
      ]),
    ];

    expect(getOpenableDocuments(tree)).toEqual([
      file('readme.md', 'readme.md'),
      file('docs/guide.md', 'guide.md'),
    ]);
  });

  it('descends into deeply nested directories', () => {
    const tree = [
      directory('a', 'a', [
        directory('a/b', 'b', [
          file('a/b/deep.md', 'deep.md'),
          file('a/b/skip.txt', 'skip.txt'),
        ]),
      ]),
    ];

    expect(getOpenableDocuments(tree)).toEqual([
      file('a/b/deep.md', 'deep.md'),
    ]);
  });

  it('handles empty input and childless directories without throwing', () => {
    expect(getOpenableDocuments([])).toEqual([]);
    expect(getOpenableDocuments([directory('empty', 'empty', [])])).toEqual([]);
  });
});
