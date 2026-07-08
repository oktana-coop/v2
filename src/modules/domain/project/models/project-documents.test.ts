import { describe, expect, it } from 'vitest';

import {
  type Directory,
  type File,
  filesystemItemTypes,
} from '../../../infrastructure/filesystem';
import { listOpenableDocuments } from './project-documents';

const file = ({ path, name }: { path: string; name: string }): File => ({
  path,
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
  children: Array<Directory | File>;
}): Directory => ({
  path,
  name,
  type: filesystemItemTypes.DIRECTORY,
  permissionState: 'granted',
  children,
});

describe('listOpenableDocuments', () => {
  it('keeps files with a supported (document) extension', () => {
    const tree = [file({ path: 'notes.md', name: 'notes.md' })];

    expect(listOpenableDocuments(tree)).toEqual([
      file({ path: 'notes.md', name: 'notes.md' }),
    ]);
  });

  it('drops files with an unsupported extension', () => {
    const tree = [
      file({ path: 'notes.md', name: 'notes.md' }),
      file({ path: 'image.png', name: 'image.png' }),
      file({ path: 'archive.pdf', name: 'archive.pdf' }),
    ];

    expect(listOpenableDocuments(tree)).toEqual([
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

    expect(listOpenableDocuments(tree)).toEqual([
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

    expect(listOpenableDocuments(tree)).toEqual([
      file({ path: 'a/b/deep.md', name: 'deep.md' }),
    ]);
  });

  it('handles empty input and childless directories without throwing', () => {
    expect(listOpenableDocuments([])).toEqual([]);
    expect(
      listOpenableDocuments([
        directory({ path: 'empty', name: 'empty', children: [] }),
      ])
    ).toEqual([]);
  });
});
