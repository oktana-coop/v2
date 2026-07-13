import {
  decodeUrlEncodedArtifactId,
  parseArtifactId,
  urlEncodeArtifactId,
} from './index';

describe('ArtifactId', () => {
  it.each([
    '/blob/main/src/index.ts', // git blob ref
    'README.md', // path-shaped
    'automerge:2akvvn8kLtfzHmWhBLRryZDif2CE', // non-git store id
  ])('accepts any non-empty opaque id: %s', (id) => {
    expect(parseArtifactId(id)).toBe(id);
  });

  it('rejects empty ids', () => {
    expect(() => parseArtifactId('')).toThrow();
  });

  it('round-trips ids through URL encoding', () => {
    const id = parseArtifactId('/blob/main/notes & drafts/plan.md');

    expect(decodeUrlEncodedArtifactId(urlEncodeArtifactId(id))).toBe(id);
  });
});
