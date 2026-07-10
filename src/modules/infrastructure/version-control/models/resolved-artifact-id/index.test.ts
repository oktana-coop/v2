import {
  decodeUrlEncodedArtifactId,
  isValidResolvedArtifactId,
  parseResolvedArtifactId,
  urlEncodeArtifactId,
} from './index';

describe('ResolvedArtifactId', () => {
  it.each([
    '/blob/main/src/index.ts', // git blob ref
    'README.md', // path-shaped
    'automerge:2akvvn8kLtfzHmWhBLRryZDif2CE', // non-git store id
  ])('accepts any non-empty opaque id: %s', (id) => {
    expect(isValidResolvedArtifactId(id)).toBe(true);
  });

  it('rejects empty ids', () => {
    expect(isValidResolvedArtifactId('')).toBe(false);
    expect(() => parseResolvedArtifactId('')).toThrow();
  });

  it('round-trips ids through URL encoding', () => {
    const id = parseResolvedArtifactId('/blob/main/notes & drafts/plan.md');

    expect(decodeUrlEncodedArtifactId(urlEncodeArtifactId(id))).toBe(id);
  });
});
