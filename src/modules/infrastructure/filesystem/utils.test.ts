import {
  getDirectoryName,
  getExtension,
  getParentPath,
  removeExtension,
  removePath,
} from './utils';

describe('filesystem/utils', () => {
  describe('removeExtension', () => {
    it('removes a .v2 extension from a file name', () => {
      expect(removeExtension('file.v2')).toBe('file');
    });

    it('removes a .txt extension from a file name', () => {
      expect(removeExtension('file.v2')).toBe('file');
    });

    it('only removes the last extension', () => {
      expect(removeExtension('file.v2.txt')).toBe('file.v2');
    });

    it('does not remove an extension if it is not present', () => {
      expect(removeExtension('file')).toBe('file');
    });
  });

  describe('getExtension', () => {
    it('returns the extension of a simple file name', () => {
      expect(getExtension('file.md')).toBe('md');
    });

    it('returns the last extension when there are multiple dots', () => {
      expect(getExtension('archive.tar.gz')).toBe('gz');
    });

    it('returns an empty string when there is no extension', () => {
      expect(getExtension('README')).toBe('');
    });

    it('returns the extension for a POSIX absolute path', () => {
      expect(getExtension('/Users/alice/documents/notes.txt')).toBe('txt');
    });

    it('returns the extension for a POSIX relative path', () => {
      expect(getExtension('src/components/App.tsx')).toBe('tsx');
    });

    it('returns the extension for a Windows absolute path', () => {
      expect(getExtension('C:\\Users\\alice\\documents\\notes.txt')).toBe(
        'txt'
      );
    });

    it('returns the extension for a Windows relative path', () => {
      expect(getExtension('src\\components\\App.tsx')).toBe('tsx');
    });

    it('does not match a dot in a POSIX directory name', () => {
      expect(getExtension('folder.backup/file')).toBe('');
    });

    it('does not match a dot in a Windows directory name', () => {
      expect(getExtension('folder.backup\\file')).toBe('');
    });

    it('returns the file extension when a POSIX directory has a dot', () => {
      expect(getExtension('folder.backup/file.md')).toBe('md');
    });

    it('returns the file extension when a Windows directory has a dot', () => {
      expect(getExtension('folder.backup\\file.md')).toBe('md');
    });

    it('returns an empty string for a dotfile without an extension', () => {
      expect(getExtension('.gitignore')).toBe('gitignore');
    });

    it('returns an empty string for an empty string', () => {
      expect(getExtension('')).toBe('');
    });
  });

  describe('removePath', () => {
    it('removes the path information from a path name', () => {
      expect(removePath('some/file.v2')).toBe('file.v2');
    });

    it('removes all the path information from a path name', () => {
      expect(removePath('some other/stuff/my file name.v2')).toBe(
        'my file name.v2'
      );
    });

    it('removes all the path information from a path name when starting with a /', () => {
      expect(removePath('/directory/name other/stuff/My Document.v2')).toBe(
        'My Document.v2'
      );
    });

    it('if no path return the filename as is', () => {
      expect(removePath('my file name.v2')).toBe('my file name.v2');
    });

    it('if odd path still return the filename', () => {
      expect(removePath('/some/ odd/path////my file name.v2')).toBe(
        'my file name.v2'
      );
    });

    it('removes the path from a Windows absolute path', () => {
      expect(removePath('C:\\Users\\alice\\notes.txt')).toBe('notes.txt');
    });

    it('removes the path from a Windows relative path', () => {
      expect(removePath('src\\components\\App.tsx')).toBe('App.tsx');
    });

    it('handles mixed separators', () => {
      expect(removePath('src/components\\App.tsx')).toBe('App.tsx');
    });

    it('returns an empty string for an empty string', () => {
      expect(removePath('')).toBe('');
    });
  });

  describe('getParentPath', () => {
    it('returns the parent for a POSIX relative path', () => {
      expect(getParentPath('src/components/App.tsx')).toBe('src/components');
    });

    it('returns the parent for a POSIX absolute path', () => {
      expect(getParentPath('/Users/alice/documents/notes.txt')).toBe(
        '/Users/alice/documents'
      );
    });

    it('returns the parent for a Windows absolute path', () => {
      expect(getParentPath('C:\\Users\\alice\\documents\\notes.txt')).toBe(
        'C:\\Users\\alice\\documents'
      );
    });

    it('returns the parent for a Windows relative path', () => {
      expect(getParentPath('src\\components\\App.tsx')).toBe('src\\components');
    });

    it('preserves separators in mixed-separator paths', () => {
      expect(getParentPath('src/components\\App.tsx')).toBe('src/components');
    });

    it('returns an empty string for a file with no parent', () => {
      expect(getParentPath('file.txt')).toBe('');
    });

    it('returns an empty string for an empty string', () => {
      expect(getParentPath('')).toBe('');
    });

    it('returns the parent for a deeply nested POSIX path', () => {
      expect(getParentPath('a/b/c/d/e.txt')).toBe('a/b/c/d');
    });

    it('returns the parent for a deeply nested Windows path', () => {
      expect(getParentPath('a\\b\\c\\d\\e.txt')).toBe('a\\b\\c\\d');
    });
  });

  describe('getDirectoryName', () => {
    it('returns the last part of a directory path', () => {
      expect(getDirectoryName('some/nested/folder')).toBe('folder');
    });

    it('handles a trailing slash', () => {
      expect(getDirectoryName('some/nested/folder/')).toBe('folder');
    });

    it('handles an absolute path', () => {
      expect(getDirectoryName('/Users/alice/documents')).toBe('documents');
    });

    it('returns the name as-is when there is no separator', () => {
      expect(getDirectoryName('folder')).toBe('folder');
    });
  });
});
