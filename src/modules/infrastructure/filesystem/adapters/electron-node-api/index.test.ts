jest.mock('node:fs', () => ({
  promises: {
    readdir: jest.fn(),
  },
}));

import { promises as fs } from 'node:fs';
import path from 'node:path';

import * as Effect from 'effect/Effect';

import { filesystemItemTypes } from '../../constants/filesystem-item-types';
import { createAdapter } from './index';

// Helper that mimics the Dirent objects returned by fs.readdir
// when called with { withFileTypes: true }
function makeDirent(
  name: string,
  isFile: boolean,
  parentPath: string
): {
  name: string;
  parentPath: string;
  isFile: () => boolean;
  isDirectory: () => boolean;
} {
  return {
    name,
    parentPath,
    isFile: () => isFile,
    isDirectory: () => !isFile,
  };
}

describe('electron-node-api filesystem adapter', () => {
  const adapter = createAdapter();
  const basePath =
    process.platform === 'win32'
      ? 'C:\\Users\\alice\\Documents'
      : '/Users/alice/Documents';

  const mockReaddirFn = fs.readdir as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listDirectoryFiles', () => {
    describe('empty directory', () => {
      it('returns empty array when no files are present', async () => {
        const entries: ReturnType<typeof makeDirent>[] = [];
        mockReaddirFn.mockResolvedValue(entries);

        const result = await Effect.runPromise(
          adapter.listDirectoryFiles({
            path: basePath,
            includeHidden: false,
            useRelativePath: true,
            recursive: false,
          })
        );

        expect(result).toEqual([]);

        expect(fs.readdir).toHaveBeenCalledWith(basePath, {
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
        mockReaddirFn.mockResolvedValue(entries);

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

        expect(fs.readdir).toHaveBeenCalledWith(basePath, {
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
        mockReaddirFn.mockResolvedValue(entries);

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

        expect(fs.readdir).toHaveBeenCalledWith(basePath, {
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
        mockReaddirFn.mockResolvedValue(entries);

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

        expect(fs.readdir).toHaveBeenCalledWith(basePath, {
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
        mockReaddirFn.mockResolvedValue(entries);

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

        expect(fs.readdir).toHaveBeenCalledWith(basePath, {
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
        mockReaddirFn.mockResolvedValue(entries);

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

        expect(fs.readdir).toHaveBeenCalledWith(basePath, {
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
        mockReaddirFn.mockResolvedValue(entries);

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

        expect(fs.readdir).toHaveBeenCalledWith(basePath, {
          withFileTypes: true,
          recursive: true,
        });
      });
    });
  });
});
