import { removeExtension } from './utils';

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
});
