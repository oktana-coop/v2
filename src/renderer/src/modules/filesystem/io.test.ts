import { getFiles } from './io';

describe('filesystem/io', () => {
  describe('getFiles', () => {
    it('returns a list of v2 files in a directory', async () => {
      const file1 = { kind: 'file', name: 'file1.v2' } as FileSystemHandle;
      const file2 = { kind: 'file', name: 'file2.v2' } as FileSystemHandle;
      const file3 = { kind: 'file', name: 'file3.txt' } as FileSystemHandle;
      const subdir = { kind: 'directory', name: 'subdir' } as FileSystemHandle;

      const mockDirectoryEntries = [
        ['file1.v2', file1],
        ['file2.v2', file2],
        ['file3.txt', file3],
        ['subdir', subdir],
      ] as Array<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;

      const mockDirHandle = {
        kind: 'directory',
        name: 'testdir',
      } as FileSystemDirectoryHandle;

      mockDirHandle.entries = jest.fn().mockReturnValue(mockDirectoryEntries);

      const files = await getFiles(mockDirHandle);

      expect(files).toStrictEqual([
        { filename: file1.name, handle: file1 },
        { filename: file2.name, handle: file2 },
      ]);
    });

    it('handles an empty directory', async () => {
      const mockDirHandle = {
        kind: 'directory',
        name: 'testdir',
      } as FileSystemDirectoryHandle;

      mockDirHandle.entries = jest.fn().mockReturnValue([]);

      const files = await getFiles(mockDirHandle);

      expect(files).toStrictEqual([]);
    });
  });
});
