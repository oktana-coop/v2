import { isGitBlobRef, isValidResolvedArtifactId } from './index';
import { createGitBlobRef, parseGitBlobRef } from './utils';

describe('ResolvedArtifactId', () => {
  it('validates Git blob references with commit SHAs', () => {
    const validRefs = [
      '/blob/4a1d2e3f/README.md', // Short SHA (8 chars)
      '/blob/4a1d2e3f4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e/README.md', // Full SHA (40 chars)
      '/blob/abc123/src/index.ts', // Short SHA (6 chars)
    ];

    validRefs.forEach((ref) => {
      expect(isValidResolvedArtifactId(ref)).toBe(true);
    });
  });

  it('validates Git blob references with branch names', () => {
    const validRefs = [
      '/blob/main/src/index.ts',
      '/blob/feat/new-feature/src/component.tsx',
      '/blob/release-1.0/CHANGELOG.md',
      '/blob/dev_branch/test.js',
      '/blob/hotfix.123/fix.ts',
    ];

    validRefs.forEach((ref) => {
      expect(isValidResolvedArtifactId(ref)).toBe(true);
    });
  });

  it('validates Git blob references with tag names', () => {
    const validRefs = [
      '/blob/v1.0.0/CHANGELOG.md',
      '/blob/release-2.3.1/README.md',
      '/blob/1.0.0-alpha.1/package.json',
    ];

    validRefs.forEach((ref) => {
      expect(isValidResolvedArtifactId(ref)).toBe(true);
    });
  });

  it.each([
    '/blob/main', // missing path
    '/blob/', // missing ref and path
    'blob/main/file.txt', // missing leading slash
    '/blob/main/', // missing file path
    '/tree/main/src/index.ts', // wrong type (tree not blob)
    '/blob/.hidden/file.txt', // ref starts with dot
    '/blob/branch../file.txt', // double dot in ref
    '/blob/branch@{/file.txt', // invalid chars @{
    '/blob/my*branch/file.txt', // invalid char *
    '/blob/my:branch/file.txt', // invalid char :
    '/blob/my?branch/file.txt', // invalid char ?
    '/blob/branch.lock/file.txt', // ends with .lock
    '/blob/branch./file.txt', // ends with dot
  ])('invalidates malformed Git blob reference: %s', (ref) => {
    expect(isValidResolvedArtifactId(ref)).toBe(false);
  });

  it('uses type guards correctly', () => {
    const gitRef = createGitBlobRef({ ref: 'main', path: 'src/index.ts' });
    expect(isGitBlobRef(gitRef)).toBe(true);

    // Type guard narrows the type
    if (isGitBlobRef(gitRef)) {
      const parsed = parseGitBlobRef(gitRef);
      expect(parsed.ref).toBe('main');
      expect(parsed.path).toBe('src/index.ts');
      expect(parsed.refType).toBe('branch-or-tag');
    }
  });

  it('parses Git blob references and identifies commit SHAs', () => {
    const commitRef = createGitBlobRef({
      ref: '4a1d2e3f',
      path: 'docs/README.md',
    });
    const parsed = parseGitBlobRef(commitRef);

    expect(parsed.ref).toBe('4a1d2e3f');
    expect(parsed.path).toBe('docs/README.md');
    expect(parsed.refType).toBe('commit');
  });

  it('parses Git blob references and identifies branches/tags', () => {
    const branchRef = createGitBlobRef({ ref: 'main', path: 'src/index.ts' });
    const parsed = parseGitBlobRef(branchRef);

    expect(parsed.ref).toBe('main');
    expect(parsed.path).toBe('src/index.ts');
    expect(parsed.refType).toBe('branch-or-tag');
  });

  it('handles paths with multiple segments', () => {
    const ref = createGitBlobRef({
      ref: 'main',
      path: 'src/components/Button/index.tsx',
    });
    const parsed = parseGitBlobRef(ref);

    expect(parsed.path).toBe('src/components/Button/index.tsx');
  });

  it('validates refs according to Git naming rules', () => {
    // Valid refs
    expect(
      isValidResolvedArtifactId(
        createGitBlobRef({ ref: 'feature-123', path: 'f.txt' })
      )
    ).toBe(true);
    expect(
      isValidResolvedArtifactId(
        createGitBlobRef({ ref: 'v1.0.0', path: 'f.txt' })
      )
    ).toBe(true);
    expect(
      isValidResolvedArtifactId(
        createGitBlobRef({ ref: 'feat/new', path: 'f.txt' })
      )
    ).toBe(true);

    // Invalid refs should throw
    expect(() => createGitBlobRef({ ref: '.hidden', path: 'f.txt' })).toThrow();
    expect(() =>
      createGitBlobRef({ ref: 'branch..name', path: 'f.txt' })
    ).toThrow();
    expect(() => createGitBlobRef({ ref: 'branch*', path: 'f.txt' })).toThrow();
  });
});
