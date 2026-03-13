import { type Dirent, promises as fs } from 'node:fs';
import path from 'node:path';

import * as Effect from 'effect/Effect';

import { filesystemItemTypes } from '../../constants/filesystem-item-types';
import {
  AccessControlError,
  AlreadyExistsError,
  NotFoundError,
  RepositoryError,
} from '../../errors';
import { createAdapter } from './index';

vi.mock('node:fs', () => {
  const promises = {
    access: vi.fn(),
    readdir: vi.fn(),
    rename: vi.fn(),
    rm: vi.fn(),
  };
  return { default: { promises }, promises };
});

// Helper that mimics the Dirent objects returned by fs.readdir
// when called with { withFileTypes: true }
function makeDirent(
  name: string,
  isFile: boolean,
  parentPath: string
): Dirent<Buffer> {
  return {
    name,
    parentPath,
    isFile: () => isFile,
    isDirectory: () => !isFile,
  } as unknown as Dirent<Buffer>;
}

describe('electron-node-api filesystem adapter', () => {
  const adapter = createAdapter();
  const basePath =
    process.platform === 'win32'
      ? 'C:\\Users\\alice\\Documents'
      : '/Users/alice/Documents';

  const mockAccess = vi.mocked(fs.access);
  const mockReaddir = vi.mocked(fs.readdir);
  const mockRename = vi.mocked(fs.rename);
  const mockRm = vi.mocked(fs.rm);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listDirectoryFiles', () => {
    describe('empty directory', () => {
      it('returns empty array when no files are present', async () => {
        const entries: ReturnType<typeof makeDirent>[] = [];
        mockReaddir.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryFiles({
            path: basePath,
            includeHidden: false,
            useRelativePath: true,
            recursive: false,
          })
        );

        expect(result).toEqual([]);

        expect(mockReaddir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
          recursive: false,
        });
      });
    });

    describe('simple visible files', () => {
      it('returns all visible files in non-recursive mode', async () => {
        const entries = [
          makeDirent('file.txt', true, basePath),
          makeDirent('document.md', true, basePath),
          makeDirent('image.png', true, basePath),
        ];
        mockReaddir.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryFiles({
            path: basePath,
            includeHidden: false,
            useRelativePath: true,
            recursive: false,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.FILE,
            name: 'file.txt',
            // file.txt
            path: 'file.txt',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'document.md',
            // document.md
            path: 'document.md',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'image.png',
            // image.png
            path: 'image.png',
          },
        ]);

        expect(mockReaddir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
          recursive: false,
        });
      });

      it('returns visible files across directories in recursive mode', async () => {
        const entries = [
          makeDirent('file.txt', true, basePath),
          makeDirent('guide.md', true, path.join(basePath, 'docs')),
          makeDirent(
            'notes.pdf',
            true,
            path.join(basePath, 'docs', 'archived')
          ),
        ];
        mockReaddir.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryFiles({
            path: basePath,
            includeHidden: false,
            useRelativePath: true,
            recursive: true,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.FILE,
            name: 'file.txt',
            // file.txt
            path: 'file.txt',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'guide.md',
            // docs/guide.md
            path: path.join('docs', 'guide.md'),
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'notes.pdf',
            // docs/archived/notes.pdf
            path: path.join('docs', 'archived', 'notes.pdf'),
          },
        ]);

        expect(mockReaddir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
          recursive: true,
        });
      });
    });

    describe('hidden files and folders', () => {
      it('filters out hidden files and folders at root level', async () => {
        const entries = [
          makeDirent('visible.txt', true, basePath),
          makeDirent('.gitignore', true, basePath),
          makeDirent('.git', false, basePath),
          makeDirent('.DS_Store', true, basePath),
          makeDirent('.env', true, basePath),
          makeDirent('another.md', true, basePath),
        ];
        mockReaddir.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryFiles({
            path: basePath,
            includeHidden: false,
            useRelativePath: true,
            recursive: false,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.FILE,
            name: 'visible.txt',
            // visible.txt
            path: 'visible.txt',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'another.md',
            // another.md
            path: 'another.md',
          },
        ]);

        expect(mockReaddir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
          recursive: false,
        });
      });

      it('filters out files inside hidden directories in recursive mode', async () => {
        const entries = [
          makeDirent('guide.md', true, basePath),
          makeDirent('settings.docx', true, basePath),
          makeDirent('HEAD', true, path.join(basePath, '.git')),
          makeDirent('5b', false, path.join(basePath, '.git', 'objects')),
          makeDirent(
            'main',
            true,
            path.join(basePath, '.git', 'refs', 'heads')
          ),
          makeDirent('cache.tmp', true, path.join(basePath, '.cache')),
        ];
        mockReaddir.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryFiles({
            path: basePath,
            includeHidden: false,
            useRelativePath: true,
            recursive: true,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.FILE,
            name: 'guide.md',
            // guide.md
            path: 'guide.md',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'settings.docx',
            // settings.docx
            path: 'settings.docx',
          },
        ]);

        expect(mockReaddir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
          recursive: true,
        });
      });
    });

    describe('complex nested structure with hidden folders', () => {
      it('returns relative paths and filters hidden entries', async () => {
        const entries = [
          makeDirent('README.md', true, basePath),
          makeDirent('intro.md', true, path.join(basePath, 'docs')),
          makeDirent(
            'templates.docx',
            true,
            path.join(basePath, 'docs', 'templates')
          ),
          makeDirent(
            'references.txt',
            true,
            path.join(basePath, 'docs', 'templates')
          ),
          // Hidden files/folders should be filtered
          makeDirent('.gitignore', true, basePath),
          makeDirent('.DS_Store', true, basePath),
          makeDirent('HEAD', true, path.join(basePath, '.git')),
          makeDirent('config', true, path.join(basePath, '.git', 'refs')),
          makeDirent('manifest.txt', true, path.join(basePath, 'metadata')),
        ];
        mockReaddir.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryFiles({
            path: basePath,
            includeHidden: false,
            useRelativePath: true,
            recursive: true,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.FILE,
            name: 'README.md',
            // README.md
            path: 'README.md',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'intro.md',
            // docs/intro.md
            path: path.join('docs', 'intro.md'),
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'templates.docx',
            // docs/templates/templates.docx
            path: path.join('docs', 'templates', 'templates.docx'),
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'references.txt',
            // docs/templates/references.txt
            path: path.join('docs', 'templates', 'references.txt'),
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'manifest.txt',
            // metadata/manifest.txt
            path: path.join('metadata', 'manifest.txt'),
          },
        ]);

        expect(mockReaddir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
          recursive: true,
        });
      });

      it('returns absolute paths for complex nested structure', async () => {
        const entries = [
          makeDirent('README.md', true, basePath),
          makeDirent('intro.md', true, path.join(basePath, 'docs')),
          makeDirent(
            'templates.docx',
            true,
            path.join(basePath, 'docs', 'templates')
          ),
          makeDirent('HEAD', true, path.join(basePath, '.git')),
          makeDirent('manifest.txt', true, path.join(basePath, 'metadata')),
        ];
        mockReaddir.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryFiles({
            path: basePath,
            includeHidden: false,
            useRelativePath: false,
            recursive: true,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.FILE,
            name: 'README.md',
            // /Users/alice/Documents/README.md
            path: path.join(basePath, 'README.md'),
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'intro.md',
            // /Users/alice/Documents/docs/intro.md
            path: path.join(basePath, 'docs', 'intro.md'),
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'templates.docx',
            // /Users/alice/Documents/docs/templates/templates.docx
            path: path.join(basePath, 'docs', 'templates', 'templates.docx'),
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'manifest.txt',
            // /Users/alice/Documents/metadata/manifest.txt
            path: path.join(basePath, 'metadata', 'manifest.txt'),
          },
        ]);

        expect(mockReaddir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
          recursive: true,
        });
      });
    });
  });

  describe('listDirectoryTree', () => {
    describe('empty directory', () => {
      it('returns empty array when no entries are present', async () => {
        // Folder structure:
        // /Users/alice/Documents/ (empty)
        const entries: ReturnType<typeof makeDirent>[] = [];
        mockReaddir.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
          })
        );

        expect(result).toEqual([]);

        expect(mockReaddir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
        });
      });
    });

    describe('root level entries', () => {
      it('filters out hidden files and directories', async () => {
        // Folder structure:
        // /Users/alice/Documents/
        //   README.md
        //   guide.md
        //   docs/
        //     intro.md
        //   .gitignore (hidden)
        //   .DS_Store (hidden)
        //   .git/ (hidden)
        mockReaddir.mockImplementation((dirPath) => {
          if (dirPath === basePath) {
            return Promise.resolve([
              makeDirent('README.md', true, basePath),
              makeDirent('docs', false, basePath),
              makeDirent('.gitignore', true, basePath),
              makeDirent('.DS_Store', true, basePath),
              makeDirent('.git', false, basePath),
              makeDirent('guide.md', true, basePath),
            ]);
          }
          if (dirPath === path.join(basePath, 'docs')) {
            return Promise.resolve([
              makeDirent('intro.md', true, path.join(basePath, 'docs')),
            ]);
          }
          return Promise.resolve([]);
        });

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'docs',
            // /Users/alice/Documents/docs
            path: path.join(basePath, 'docs'),
            children: [
              {
                type: filesystemItemTypes.FILE,
                name: 'intro.md',
                // /Users/alice/Documents/docs/intro.md
                path: path.join(basePath, 'docs', 'intro.md'),
              },
            ],
            permissionState: 'granted',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'guide.md',
            // /Users/alice/Documents/guide.md
            path: path.join(basePath, 'guide.md'),
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'README.md',
            // /Users/alice/Documents/README.md
            path: path.join(basePath, 'README.md'),
          },
        ]);
      });

      it('returns relative paths when useRelativePathTo is set', async () => {
        // Folder structure:
        // /Users/alice/Documents/
        //   README.md
        //   guide.md
        //   metadata/
        //     manifest.txt
        mockReaddir.mockImplementation((dirPath) => {
          if (dirPath === basePath) {
            return Promise.resolve([
              makeDirent('README.md', true, basePath),
              makeDirent('guide.md', true, basePath),
              makeDirent('metadata', false, basePath),
            ]);
          }
          if (dirPath === path.join(basePath, 'metadata')) {
            return Promise.resolve([
              makeDirent('manifest.txt', true, path.join(basePath, 'metadata')),
            ]);
          }
          return Promise.resolve([]);
        });

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
            useRelativePathTo: basePath,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'metadata',
            // metadata
            path: 'metadata',
            children: [
              {
                type: filesystemItemTypes.FILE,
                name: 'manifest.txt',
                // metadata/manifest.txt
                path: path.join('metadata', 'manifest.txt'),
              },
            ],
            permissionState: 'granted',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'guide.md',
            // guide.md
            path: 'guide.md',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'README.md',
            // README.md
            path: 'README.md',
          },
        ]);
      });

      it('returns simple files inside folder without subdirectories', async () => {
        // Folder structure:
        // /Users/alice/Documents/
        //   archive/
        //     document.pdf
        //     notes.txt
        //     guide.md
        mockReaddir.mockImplementation((dirPath) => {
          if (dirPath === basePath) {
            return Promise.resolve([makeDirent('archive', false, basePath)]);
          }
          if (dirPath === path.join(basePath, 'archive')) {
            return Promise.resolve([
              makeDirent('document.pdf', true, path.join(basePath, 'archive')),
              makeDirent('notes.txt', true, path.join(basePath, 'archive')),
              makeDirent('guide.md', true, path.join(basePath, 'archive')),
            ]);
          }
          return Promise.resolve([]);
        });

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'archive',
            // /Users/alice/Documents/archive
            path: path.join(basePath, 'archive'),
            children: [
              {
                type: filesystemItemTypes.FILE,
                name: 'document.pdf',
                // /Users/alice/Documents/archive/document.pdf
                path: path.join(basePath, 'archive', 'document.pdf'),
              },
              {
                type: filesystemItemTypes.FILE,
                name: 'guide.md',
                // /Users/alice/Documents/archive/guide.md
                path: path.join(basePath, 'archive', 'guide.md'),
              },
              {
                type: filesystemItemTypes.FILE,
                name: 'notes.txt',
                // /Users/alice/Documents/archive/notes.txt
                path: path.join(basePath, 'archive', 'notes.txt'),
              },
            ],
            permissionState: 'granted',
          },
        ]);
      });

      it('returns empty directory without children', async () => {
        // Folder structure:
        // /Users/alice/Documents/
        //   empty-folder/ (empty)
        mockReaddir.mockImplementation((dirPath) => {
          if (dirPath === basePath) {
            return Promise.resolve([
              makeDirent('empty-folder', false, basePath),
            ]);
          }
          if (dirPath === path.join(basePath, 'empty-folder')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        });

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'empty-folder',
            // /Users/alice/Documents/empty-folder
            path: path.join(basePath, 'empty-folder'),
            children: [],
            permissionState: 'granted',
          },
        ]);
      });

      it('respects depth limit of 1', async () => {
        // Folder structure:
        // /Users/alice/Documents/
        //   README.md
        //   docs/ (not traversed due to depth: 1)
        const entries = [
          makeDirent('docs', false, basePath),
          makeDirent('README.md', true, basePath),
        ];
        mockReaddir.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
            depth: 1,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'docs',
            // /Users/alice/Documents/docs
            path: path.join(basePath, 'docs'),
            // Returning undefined children indicates that we haven't loaded the contents of this directory,
            children: undefined,
            permissionState: 'granted',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'README.md',
            // /Users/alice/Documents/README.md
            path: path.join(basePath, 'README.md'),
          },
        ]);

        expect(mockReaddir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
        });
      });
    });

    describe('recursive nested structure', () => {
      it('builds tree with children when depth allows', async () => {
        // Folder structure:
        // /Users/alice/Documents/
        //   README.md
        //   docs/
        //     intro.md
        //     templates/
        //       templates.docx
        //   metadata/
        //     manifest.txt
        // Mock fs.readdir to return different entries based on the path parameter
        mockReaddir.mockImplementation((dirPath) => {
          if (dirPath === basePath) {
            return Promise.resolve([
              makeDirent('README.md', true, basePath),
              makeDirent('docs', false, basePath),
              makeDirent('metadata', false, basePath),
            ]);
          }
          if (dirPath === path.join(basePath, 'docs')) {
            return Promise.resolve([
              makeDirent('intro.md', true, path.join(basePath, 'docs')),
              makeDirent('templates', false, path.join(basePath, 'docs')),
            ]);
          }
          if (dirPath === path.join(basePath, 'docs', 'templates')) {
            return Promise.resolve([
              makeDirent(
                'templates.docx',
                true,
                path.join(basePath, 'docs', 'templates')
              ),
            ]);
          }
          if (dirPath === path.join(basePath, 'metadata')) {
            return Promise.resolve([
              makeDirent('manifest.txt', true, path.join(basePath, 'metadata')),
            ]);
          }
          return Promise.resolve([]);
        });

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'docs',
            // /Users/alice/Documents/docs
            path: path.join(basePath, 'docs'),
            children: [
              {
                type: filesystemItemTypes.DIRECTORY,
                name: 'templates',
                // /Users/alice/Documents/docs/templates
                path: path.join(basePath, 'docs', 'templates'),
                children: [
                  {
                    type: filesystemItemTypes.FILE,
                    name: 'templates.docx',
                    // /Users/alice/Documents/docs/templates/templates.docx
                    path: path.join(
                      basePath,
                      'docs',
                      'templates',
                      'templates.docx'
                    ),
                  },
                ],
                permissionState: 'granted',
              },
              {
                type: filesystemItemTypes.FILE,
                name: 'intro.md',
                // /Users/alice/Documents/docs/intro.md
                path: path.join(basePath, 'docs', 'intro.md'),
              },
            ],
            permissionState: 'granted',
          },
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'metadata',
            // /Users/alice/Documents/metadata
            path: path.join(basePath, 'metadata'),
            children: [
              {
                type: filesystemItemTypes.FILE,
                name: 'manifest.txt',
                // /Users/alice/Documents/metadata/manifest.txt
                path: path.join(basePath, 'metadata', 'manifest.txt'),
              },
            ],
            permissionState: 'granted',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'README.md',
            // /Users/alice/Documents/README.md
            path: path.join(basePath, 'README.md'),
          },
        ]);
      });

      it('returns relative paths in recursive tree', async () => {
        // Folder structure:
        // /Users/alice/Documents/
        //   README.md
        //   docs/
        //     intro.md
        //     templates/
        //       guide.pdf
        mockReaddir.mockImplementation((dirPath) => {
          if (dirPath === basePath) {
            return Promise.resolve([
              makeDirent('README.md', true, basePath),
              makeDirent('docs', false, basePath),
            ]);
          }
          if (dirPath === path.join(basePath, 'docs')) {
            return Promise.resolve([
              makeDirent('intro.md', true, path.join(basePath, 'docs')),
              makeDirent('templates', false, path.join(basePath, 'docs')),
            ]);
          }
          if (dirPath === path.join(basePath, 'docs', 'templates')) {
            return Promise.resolve([
              makeDirent(
                'guide.pdf',
                true,
                path.join(basePath, 'docs', 'templates')
              ),
            ]);
          }
          return Promise.resolve([]);
        });

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
            useRelativePathTo: basePath,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'docs',
            // docs
            path: 'docs',
            children: [
              {
                type: filesystemItemTypes.DIRECTORY,
                name: 'templates',
                // docs/templates
                path: path.join('docs', 'templates'),
                children: [
                  {
                    type: filesystemItemTypes.FILE,
                    name: 'guide.pdf',
                    // docs/templates/guide.pdf
                    path: path.join('docs', 'templates', 'guide.pdf'),
                  },
                ],
                permissionState: 'granted',
              },
              {
                type: filesystemItemTypes.FILE,
                name: 'intro.md',
                // docs/intro.md
                path: path.join('docs', 'intro.md'),
              },
            ],
            permissionState: 'granted',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'README.md',
            // README.md
            path: 'README.md',
          },
        ]);
      });

      it('respects depth limit in recursive structure', async () => {
        // Folder structure:
        // /Users/alice/Documents/
        //   README.md
        //   docs/
        //     intro.md
        //     templates/ (not traversed due to depth: 2)
        mockReaddir.mockImplementation((dirPath) => {
          if (dirPath === basePath) {
            return Promise.resolve([
              makeDirent('docs', false, basePath),
              makeDirent('README.md', true, basePath),
            ]);
          }
          if (dirPath === path.join(basePath, 'docs')) {
            return Promise.resolve([
              makeDirent('templates', false, path.join(basePath, 'docs')),
              makeDirent('intro.md', true, path.join(basePath, 'docs')),
            ]);
          }
          return Promise.resolve([]);
        });

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
            depth: 2,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'docs',
            // /Users/alice/Documents/docs
            path: path.join(basePath, 'docs'),
            children: [
              {
                type: filesystemItemTypes.DIRECTORY,
                name: 'templates',
                // /Users/alice/Documents/docs/templates
                path: path.join(basePath, 'docs', 'templates'),
                children: undefined,
                permissionState: 'granted',
              },
              {
                type: filesystemItemTypes.FILE,
                name: 'intro.md',
                // /Users/alice/Documents/docs/intro.md
                path: path.join(basePath, 'docs', 'intro.md'),
              },
            ],
            permissionState: 'granted',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'README.md',
            // /Users/alice/Documents/README.md
            path: path.join(basePath, 'README.md'),
          },
        ]);
      });

      it('handles repeated file and folder names at different nesting levels', async () => {
        // Folder structure:
        // /Users/alice/Documents/
        //   index.md
        //   data/
        //     index.md
        //     config/
        //       index.md
        //   archive/
        //     index.md
        //     data/ (different from root data/)
        //       notes.txt
        // This ensures the implementation uses full paths, not just names
        mockReaddir.mockImplementation((dirPath) => {
          if (dirPath === basePath) {
            return Promise.resolve([
              makeDirent('index.md', true, basePath),
              makeDirent('data', false, basePath),
              makeDirent('archive', false, basePath),
            ]);
          }
          if (dirPath === path.join(basePath, 'data')) {
            return Promise.resolve([
              makeDirent('index.md', true, path.join(basePath, 'data')),
              makeDirent('config', false, path.join(basePath, 'data')),
            ]);
          }
          if (dirPath === path.join(basePath, 'data', 'config')) {
            return Promise.resolve([
              makeDirent(
                'index.md',
                true,
                path.join(basePath, 'data', 'config')
              ),
            ]);
          }
          if (dirPath === path.join(basePath, 'archive')) {
            return Promise.resolve([
              makeDirent('index.md', true, path.join(basePath, 'archive')),
              makeDirent('data', false, path.join(basePath, 'archive')),
            ]);
          }
          if (dirPath === path.join(basePath, 'archive', 'data')) {
            return Promise.resolve([
              makeDirent(
                'notes.txt',
                true,
                path.join(basePath, 'archive', 'data')
              ),
            ]);
          }
          return Promise.resolve([]);
        });

        const result = await Effect.runPromise(
          adapter.listDirectoryTree({
            path: basePath,
            includeHidden: false,
          })
        );

        expect(result).toEqual([
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'archive',
            // /Users/alice/Documents/archive
            path: path.join(basePath, 'archive'),
            children: [
              {
                type: filesystemItemTypes.DIRECTORY,
                name: 'data',
                // /Users/alice/Documents/archive/data
                path: path.join(basePath, 'archive', 'data'),
                children: [
                  {
                    type: filesystemItemTypes.FILE,
                    name: 'notes.txt',
                    // /Users/alice/Documents/archive/data/notes.txt
                    path: path.join(basePath, 'archive', 'data', 'notes.txt'),
                  },
                ],
                permissionState: 'granted',
              },
              {
                type: filesystemItemTypes.FILE,
                name: 'index.md',
                // /Users/alice/Documents/archive/index.md
                path: path.join(basePath, 'archive', 'index.md'),
              },
            ],
            permissionState: 'granted',
          },
          {
            type: filesystemItemTypes.DIRECTORY,
            name: 'data',
            // /Users/alice/Documents/data
            path: path.join(basePath, 'data'),
            children: [
              {
                type: filesystemItemTypes.DIRECTORY,
                name: 'config',
                // /Users/alice/Documents/data/config
                path: path.join(basePath, 'data', 'config'),
                children: [
                  {
                    type: filesystemItemTypes.FILE,
                    name: 'index.md',
                    // /Users/alice/Documents/data/config/index.md
                    path: path.join(basePath, 'data', 'config', 'index.md'),
                  },
                ],
                permissionState: 'granted',
              },
              {
                type: filesystemItemTypes.FILE,
                name: 'index.md',
                // /Users/alice/Documents/data/index.md
                path: path.join(basePath, 'data', 'index.md'),
              },
            ],
            permissionState: 'granted',
          },
          {
            type: filesystemItemTypes.FILE,
            name: 'index.md',
            // /Users/alice/Documents/index.md
            path: path.join(basePath, 'index.md'),
          },
        ]);
      });
    });
  });

  describe('getRenamedPath', () => {
    it('preserves extension when renaming a file in a directory', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({
          oldPath: path.join(basePath, 'notes.md'),
          newName: 'renamed',
        })
      );

      expect(result).toBe(path.join(basePath, 'renamed.md'));
    });

    it('produces no leading dot-slash for a filename without a parent directory', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({ oldPath: 'notes.md', newName: 'renamed' })
      );

      expect(result).toBe('renamed.md');
    });

    it('works for files in subdirectories', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({
          oldPath: path.join(basePath, 'docs', 'intro.md'),
          newName: 'getting-started',
        })
      );

      expect(result).toBe(path.join(basePath, 'docs', 'getting-started.md'));
    });

    it('preserves a file with no extension', async () => {
      const result = await Effect.runPromise(
        adapter.getRenamedPath({
          oldPath: path.join(basePath, 'LICENSE'),
          newName: 'NOTICE',
        })
      );

      expect(result).toBe(path.join(basePath, 'NOTICE'));
    });
  });

  describe('deleteDirectory', () => {
    const mockNodeError = (code: string) =>
      Object.assign(new Error(code), { code });

    const dirPath = path.join(basePath, 'my-folder');

    it('removes the directory recursively', async () => {
      mockRm.mockResolvedValue(undefined);

      await Effect.runPromise(adapter.deleteDirectory({ path: dirPath }));

      expect(mockRm).toHaveBeenCalledWith(dirPath, { recursive: true });
    });

    it('fails with NotFoundError when the directory does not exist', async () => {
      mockRm.mockRejectedValue(mockNodeError('ENOENT'));

      const err = await Effect.runPromise(
        Effect.flip(adapter.deleteDirectory({ path: dirPath }))
      );

      expect(err).toBeInstanceOf(NotFoundError);
    });

    it('fails with AccessControlError on permission denied', async () => {
      mockRm.mockRejectedValue(mockNodeError('EACCES'));

      const err = await Effect.runPromise(
        Effect.flip(adapter.deleteDirectory({ path: dirPath }))
      );

      expect(err).toBeInstanceOf(AccessControlError);
    });

    it('fails with RepositoryError for other Node.js errors', async () => {
      mockRm.mockRejectedValue(mockNodeError('EIO'));

      const err = await Effect.runPromise(
        Effect.flip(adapter.deleteDirectory({ path: dirPath }))
      );

      expect(err).toBeInstanceOf(RepositoryError);
    });

    it('fails with RepositoryError for non-Node.js errors', async () => {
      mockRm.mockRejectedValue(new TypeError('unexpected'));

      const err = await Effect.runPromise(
        Effect.flip(adapter.deleteDirectory({ path: dirPath }))
      );

      expect(err).toBeInstanceOf(RepositoryError);
    });
  });

  describe('renameFile', () => {
    const mockNodeError = (code: string) =>
      Object.assign(new Error(code), { code });

    const oldPath = path.join(basePath, 'notes.md');
    const newPath = path.join(basePath, 'renamed.md');

    it('renames the file when the target does not exist', async () => {
      mockAccess.mockRejectedValue(mockNodeError('ENOENT'));
      mockRename.mockResolvedValue(undefined);

      await Effect.runPromise(adapter.renameFile({ oldPath, newPath }));

      expect(mockRename).toHaveBeenCalledWith(oldPath, newPath);
    });

    it('fails with AlreadyExistsError when the target already exists', async () => {
      mockAccess.mockResolvedValue(undefined);

      // Effect.flip swaps the error and success channels, letting us
      // assert on the failure value via runPromise
      const err = await Effect.runPromise(
        Effect.flip(adapter.renameFile({ oldPath, newPath }))
      );

      expect(err).toBeInstanceOf(AlreadyExistsError);
      expect(mockRename).not.toHaveBeenCalled();
    });

    it('fails with NotFoundError when the source file does not exist', async () => {
      mockAccess.mockRejectedValue(mockNodeError('ENOENT'));
      mockRename.mockRejectedValue(mockNodeError('ENOENT'));

      const err = await Effect.runPromise(
        Effect.flip(adapter.renameFile({ oldPath, newPath }))
      );

      expect(err).toBeInstanceOf(NotFoundError);
    });

    it('fails with AccessControlError on permission denied', async () => {
      mockAccess.mockRejectedValue(mockNodeError('ENOENT'));
      mockRename.mockRejectedValue(mockNodeError('EACCES'));

      const err = await Effect.runPromise(
        Effect.flip(adapter.renameFile({ oldPath, newPath }))
      );

      expect(err).toBeInstanceOf(AccessControlError);
    });

    it('fails with RepositoryError for other Node.js errors', async () => {
      mockAccess.mockRejectedValue(mockNodeError('ENOENT'));
      mockRename.mockRejectedValue(mockNodeError('EIO'));

      const err = await Effect.runPromise(
        Effect.flip(adapter.renameFile({ oldPath, newPath }))
      );

      expect(err).toBeInstanceOf(RepositoryError);
    });

    it('fails with RepositoryError for non-Node.js errors', async () => {
      mockAccess.mockRejectedValue(mockNodeError('ENOENT'));
      mockRename.mockRejectedValue(new TypeError('unexpected'));

      const err = await Effect.runPromise(
        Effect.flip(adapter.renameFile({ oldPath, newPath }))
      );

      expect(err).toBeInstanceOf(RepositoryError);
    });
  });
});
