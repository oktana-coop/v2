import { isValidBranchOrTagName, parseBranch } from './index';

describe('Branch', () => {
  describe('valid names', () => {
    const validNames = [
      'main',
      'feature/add-stuff',
      'bugfix/fix-1',
      'release/1.0.0',
      'hotfix/urgent',
      'A123',
      'my.branch.name',
      'my_branch',
      'my-branch',
      'path/to/thing',
      'v1.2.3',
      'fix/some.stuff-here_123',
    ];

    validNames.forEach((name) => {
      it(`accepts valid branch name: "${name}"`, () => {
        expect(isValidBranchOrTagName(name)).toBe(true);
      });
    });
  });

  describe('invalid names: start/end rules', () => {
    const invalidNames = [
      '',
      '.startsWithDot',
      '/startsWithSlash',
      'endsWithDot.',
      'endsWithSlash/',
      'thing.lock',
    ];

    invalidNames.forEach((name) => {
      it(`rejects invalid start/end branch name: "${name}"`, () => {
        expect(isValidBranchOrTagName(name)).toBe(false);
      });
    });
  });

  describe('invalid names: invalid characters', () => {
    const invalidNames = [
      'has space', // space not allowed by BRANCH_TAG_REGEX
      'double..dots',
      'weird@name',
      'slash//slash',
      'bad:name',
      'no~tilde',
      'caret^thing',
      'q*mark',
      'bracket[name',
      'control\u0001char',
      'back\\slash',
      'at{brace',
      'at{brace', // @{ (explicit)
      '@{not allowed}',
    ];

    invalidNames.forEach((name) => {
      it(`rejects invalid-character branch name: "${name}"`, () => {
        expect(isValidBranchOrTagName(name)).toBe(false);
      });
    });
  });

  describe('parsing with zod', () => {
    it('passes valid names', () => {
      expect(() => parseBranch('feature/good')).not.toThrow();
    });

    it('fails invalid names', () => {
      expect(() => parseBranch('.bad')).toThrow(/Invalid branch name/);
    });
  });
});
