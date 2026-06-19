import { ancestorDirs } from './ephemeral-wasi-files';

describe('ancestorDirs', () => {
  it('returns each ancestor directory, shallowest first', () => {
    expect(ancestorDirs('/a/b/c.txt')).toEqual(['/a', '/a/b']);
  });

  it('returns none for a file at the root', () => {
    expect(ancestorDirs('/file.txt')).toEqual([]);
  });

  it('handles deeply nested paths', () => {
    expect(ancestorDirs('/lib/shared/util/strings.txt')).toEqual([
      '/lib',
      '/lib/shared',
      '/lib/shared/util',
    ]);
  });

  it('normalizes Windows-style separators', () => {
    expect(ancestorDirs('\\lib\\shared\\strings.txt')).toEqual([
      '/lib',
      '/lib/shared',
    ]);
  });
});
