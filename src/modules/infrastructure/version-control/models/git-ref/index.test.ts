import { type ArtifactId } from '../artifact-id';
import {
  createGitBlobRef,
  createGitTreeRef,
  decomposeGitRef,
  gitTreeRefSchema,
  isGitBlobRef,
  isGitRef,
  isGitTreeRef,
  isValidGitBlobRef,
} from './index';

describe('GitBlobRef', () => {
  it('validates Git blob references with commit SHAs', () => {
    const validRefs = [
      '/blob/4a1d2e3f/README.md', // Short SHA (8 chars)
      '/blob/4a1d2e3f4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e/README.md', // Full SHA (40 chars)
      '/blob/abc123/src/index.ts', // Short SHA (6 chars)
    ];

    validRefs.forEach((ref) => {
      expect(isValidGitBlobRef(ref)).toBe(true);
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
      expect(isValidGitBlobRef(ref)).toBe(true);
    });
  });

  it('validates Git blob references with tag names', () => {
    const validRefs = [
      '/blob/v1.0.0/CHANGELOG.md',
      '/blob/release-2.3.1/README.md',
      '/blob/1.0.0-alpha.1/package.json',
    ];

    validRefs.forEach((ref) => {
      expect(isValidGitBlobRef(ref)).toBe(true);
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
    expect(isValidGitBlobRef(ref)).toBe(false);
  });

  it('uses type guards correctly', () => {
    const gitRef = createGitBlobRef({ ref: 'main', path: 'src/index.ts' });
    expect(isGitBlobRef(gitRef)).toBe(true);

    // Type guard narrows the type
    if (isGitBlobRef(gitRef)) {
      const decomposed = decomposeGitRef(gitRef);
      expect(decomposed.ref).toBe('main');
      expect(decomposed.path).toBe('src/index.ts');
      expect(decomposed.refType).toBe('branch-or-tag');
    }
  });

  it('parses Git blob references and identifies commit SHAs', () => {
    const commitRef = createGitBlobRef({
      ref: '4a1d2e3f',
      path: 'docs/README.md',
    });
    const decomposed = decomposeGitRef(commitRef);

    expect(decomposed.ref).toBe('4a1d2e3f');
    expect(decomposed.path).toBe('docs/README.md');
    expect(decomposed.refType).toBe('commit');
  });

  it('parses Git blob references and identifies branches/tags', () => {
    const branchRef = createGitBlobRef({ ref: 'main', path: 'src/index.ts' });
    const decomposed = decomposeGitRef(branchRef);

    expect(decomposed.ref).toBe('main');
    expect(decomposed.path).toBe('src/index.ts');
    expect(decomposed.refType).toBe('branch-or-tag');
  });

  it('handles paths with multiple segments', () => {
    const ref = createGitBlobRef({
      ref: 'main',
      path: 'src/components/Button/index.tsx',
    });
    const decomposed = decomposeGitRef(ref);

    expect(decomposed.path).toBe('src/components/Button/index.tsx');
  });

  it('validates refs according to Git naming rules', () => {
    expect(
      isValidGitBlobRef(createGitBlobRef({ ref: 'feature-123', path: 'f.txt' }))
    ).toBe(true);
    expect(
      isValidGitBlobRef(createGitBlobRef({ ref: 'v1.0.0', path: 'f.txt' }))
    ).toBe(true);
    expect(
      isValidGitBlobRef(createGitBlobRef({ ref: 'feat/new', path: 'f.txt' }))
    ).toBe(true);

    // Invalid refs should throw
    expect(() => createGitBlobRef({ ref: '.hidden', path: 'f.txt' })).toThrow();
    expect(() =>
      createGitBlobRef({ ref: 'branch..name', path: 'f.txt' })
    ).toThrow();
    expect(() => createGitBlobRef({ ref: 'branch*', path: 'f.txt' })).toThrow();
  });
});

describe('GitTreeRef', () => {
  it('validates Git tree references with SHAs, branches, and tags', () => {
    const validRefs = [
      '/tree/4a1d2e3f/docs', // Short SHA
      '/tree/4a1d2e3f4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e/src/components', // Full SHA
      '/tree/main/docs', // Branch
      '/tree/feat/new-feature/src', // Branch with slash
      '/tree/v1.0.0/assets', // Tag
    ];

    validRefs.forEach((ref) => {
      expect(gitTreeRefSchema.safeParse(ref).success).toBe(true);
    });
  });

  it.each([
    '/tree/main', // missing path
    '/tree/', // missing ref and path
    'tree/main/docs', // missing leading slash
    '/tree/main/', // missing directory path
    '/blob/main/docs', // wrong type (blob not tree)
    '/tree/.hidden/docs', // ref starts with dot
    '/tree/branch../docs', // double dot in ref
    '/tree/my*branch/docs', // invalid char *
    '/tree/branch.lock/docs', // ends with .lock
  ])('invalidates malformed Git tree reference: %s', (ref) => {
    expect(gitTreeRefSchema.safeParse(ref).success).toBe(false);
  });

  it('creates a tree ref and recognizes it with the type guards', () => {
    const treeRef = createGitTreeRef({ ref: 'main', path: 'docs/guides' });

    expect(treeRef).toBe('/tree/main/docs/guides');
    expect(isGitTreeRef(treeRef)).toBe(true);
    expect(isGitBlobRef(treeRef)).toBe(false);
  });

  it('decomposes tree refs identifying branches/tags and commits', () => {
    expect(
      decomposeGitRef(createGitTreeRef({ ref: 'main', path: 'docs' }))
    ).toEqual({
      ref: 'main',
      path: 'docs',
      refType: 'branch-or-tag',
    });

    expect(
      decomposeGitRef(createGitTreeRef({ ref: '4a1d2e3f', path: 'docs/2024' }))
    ).toEqual({
      ref: '4a1d2e3f',
      path: 'docs/2024',
      refType: 'commit',
    });
  });

  it('throws when creating a tree ref with an invalid ref', () => {
    expect(() => createGitTreeRef({ ref: '.hidden', path: 'docs' })).toThrow();
    expect(() => createGitTreeRef({ ref: 'branch*', path: 'docs' })).toThrow();
  });
});

describe('isGitRef', () => {
  it('recognizes both blob and tree refs', () => {
    expect(isGitRef(createGitBlobRef({ ref: 'main', path: 'readme.md' }))).toBe(
      true
    );
    expect(isGitRef(createGitTreeRef({ ref: 'main', path: 'docs' }))).toBe(
      true
    );
  });

  it('rejects a non-git artifact id', () => {
    expect(isGitRef('automerge:abc123' as ArtifactId)).toBe(false);
  });
});
