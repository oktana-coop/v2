import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { VersionedDocumentValidationErrorTag } from '../errors';
import {
  isAbsoluteAssetSrc,
  parseAssetDocRelPath,
  parseAssetDocRelPathEffect,
  parseDocumentAssetSrc,
  parseDocumentAssetSrcEffect,
  safeParseAssetDocRelPath,
  safeParseDocumentAssetSrc,
} from './document-asset-src';

describe('isAbsoluteAssetSrc', () => {
  it('returns true for http(s) URLs', () => {
    expect(isAbsoluteAssetSrc('https://example.com/a.jpg')).toBe(true);
    expect(isAbsoluteAssetSrc('http://example.com/a.jpg')).toBe(true);
  });

  it('returns true for data URLs', () => {
    expect(isAbsoluteAssetSrc('data:image/png;base64,iVBORw0KG')).toBe(true);
  });

  it('returns true for custom schemes', () => {
    expect(isAbsoluteAssetSrc('project-asset://project/x/a.jpg')).toBe(true);
  });

  it('returns false for relative paths', () => {
    expect(isAbsoluteAssetSrc('assets/a.jpg')).toBe(false);
    expect(isAbsoluteAssetSrc('../assets/a.jpg')).toBe(false);
    expect(isAbsoluteAssetSrc('./a.jpg')).toBe(false);
  });
});

describe('assetDocRelPathSchema', () => {
  it('accepts a same-folder reference', () => {
    expect(parseAssetDocRelPath('img.jpg')).toBe('img.jpg');
  });

  it('accepts a path with ".." segments', () => {
    expect(parseAssetDocRelPath('../assets/foo.png')).toBe('../assets/foo.png');
    expect(parseAssetDocRelPath('../../shared/x.jpg')).toBe(
      '../../shared/x.jpg'
    );
  });

  it('normalizes backslashes to slashes', () => {
    expect(parseAssetDocRelPath('..\\assets\\foo.png')).toBe(
      '../assets/foo.png'
    );
  });

  it('rejects empty strings', () => {
    expect(safeParseAssetDocRelPath('').success).toBe(false);
  });

  it('rejects paths with a leading slash', () => {
    expect(safeParseAssetDocRelPath('/assets/foo.png').success).toBe(false);
  });

  it('rejects absolute URLs', () => {
    expect(safeParseAssetDocRelPath('https://example.com/a.jpg').success).toBe(
      false
    );
    expect(
      safeParseAssetDocRelPath('project-asset://project/x/a.jpg').success
    ).toBe(false);
    expect(safeParseAssetDocRelPath('data:image/png;base64,abc').success).toBe(
      false
    );
  });
});

describe('parseAssetDocRelPathEffect', () => {
  it('succeeds with the branded path for valid input', () => {
    const result = Effect.runSync(
      Effect.either(parseAssetDocRelPathEffect('../assets/foo.png'))
    );
    expect(result._tag).toBe('Right');
    if (result._tag === 'Right') {
      expect(result.right).toBe('../assets/foo.png');
    }
  });

  it('fails with ValidationError for an absolute URL', () => {
    const result = Effect.runSync(
      Effect.either(parseAssetDocRelPathEffect('https://example.com/a.jpg'))
    );
    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe(VersionedDocumentValidationErrorTag);
    }
  });
});

describe('documentAssetSrcSchema', () => {
  it('accepts an absolute URL', () => {
    expect(parseDocumentAssetSrc('https://example.com/a.jpg')).toBe(
      'https://example.com/a.jpg'
    );
  });

  it('accepts a doc-relative path', () => {
    expect(parseDocumentAssetSrc('../assets/a.jpg')).toBe('../assets/a.jpg');
  });

  it('narrows via isAbsoluteAssetSrc', () => {
    const absolute = parseDocumentAssetSrc('https://example.com/a.jpg');
    const docRel = parseDocumentAssetSrc('assets/a.jpg');
    expect(isAbsoluteAssetSrc(absolute)).toBe(true);
    expect(isAbsoluteAssetSrc(docRel)).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(safeParseDocumentAssetSrc('').success).toBe(false);
  });

  it('rejects paths with a leading slash', () => {
    expect(safeParseDocumentAssetSrc('/assets/a.jpg').success).toBe(false);
  });
});

describe('parseDocumentAssetSrcEffect', () => {
  it('succeeds for an absolute URL', () => {
    const result = Effect.runSync(
      Effect.either(parseDocumentAssetSrcEffect('https://example.com/a.jpg'))
    );
    expect(result._tag).toBe('Right');
    if (result._tag === 'Right') {
      expect(result.right).toBe('https://example.com/a.jpg');
    }
  });

  it('succeeds for a doc-relative path', () => {
    const result = Effect.runSync(
      Effect.either(parseDocumentAssetSrcEffect('../assets/a.jpg'))
    );
    expect(result._tag).toBe('Right');
    if (result._tag === 'Right') {
      expect(result.right).toBe('../assets/a.jpg');
    }
  });

  it('fails with ValidationError for invalid input', () => {
    const result = Effect.runSync(
      Effect.either(parseDocumentAssetSrcEffect('/assets/a.jpg'))
    );
    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe(VersionedDocumentValidationErrorTag);
    }
  });
});
