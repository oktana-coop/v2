import { removeExtension, removePath } from './utils';

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
  });
});
