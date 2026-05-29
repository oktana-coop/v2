import { describe, expect, it } from 'vitest';

import { extractAssetReferencesFromMarkdown } from './extract-from-markdown';

describe('extractAssetReferencesFromMarkdown', () => {
  it('returns an empty list for content without image refs', () => {
    expect(
      extractAssetReferencesFromMarkdown('# Title\n\nNo images here.')
    ).toEqual([]);
  });

  it('extracts a single Markdown image ref', () => {
    expect(
      extractAssetReferencesFromMarkdown('![alt](assets/foo.png)')
    ).toEqual(['assets/foo.png']);
  });

  it('extracts refs from arbitrary folders, not only assets/', () => {
    const md = '![a](assets/x.png)\n![b](images/y.png)\n![c](z.png)';
    expect(extractAssetReferencesFromMarkdown(md)).toEqual([
      'assets/x.png',
      'images/y.png',
      'z.png',
    ]);
  });

  it('strips a leading `./`', () => {
    expect(
      extractAssetReferencesFromMarkdown('![a](./assets/foo.png)')
    ).toEqual(['assets/foo.png']);
  });

  it('normalizes Windows-style separators', () => {
    expect(
      extractAssetReferencesFromMarkdown('![a](assets\\sub\\foo.png)')
    ).toEqual(['assets/sub/foo.png']);
  });

  it('strips fragments and query strings', () => {
    expect(
      extractAssetReferencesFromMarkdown(
        '![a](assets/foo.png?v=1)\n![b](assets/bar.png#hero)'
      )
    ).toEqual(['assets/foo.png', 'assets/bar.png']);
  });

  it('handles a Pandoc-style title following the URL', () => {
    expect(
      extractAssetReferencesFromMarkdown('![alt](assets/foo.png "a title")')
    ).toEqual(['assets/foo.png']);
  });

  it('skips external URLs', () => {
    const md = [
      '![a](https://example.com/foo.png)',
      '![b](http://example.com/bar.png)',
      '![c](//example.com/baz.png)',
      '![d](data:image/png;base64,xyz)',
      '![e](assets/local.png)',
    ].join('\n');
    expect(extractAssetReferencesFromMarkdown(md)).toEqual([
      'assets/local.png',
    ]);
  });

  it('dedupes repeated refs', () => {
    const md =
      '![a](assets/foo.png)\n![b](assets/foo.png)\n![c](assets/foo.png)';
    expect(extractAssetReferencesFromMarkdown(md)).toEqual(['assets/foo.png']);
  });
});
