import { describe, expect, it } from 'vitest';

import { isIgnored } from './index';

const ignoredTopLevelEntries = ['.git'];

describe('directory-watcher/electron-node-api', () => {
  describe('isIgnored', () => {
    it('drops a listed entry', () => {
      expect(
        isIgnored({ filename: '.git/index', ignoredTopLevelEntries })
      ).toBe(true);
    });

    it('drops anything nested under a listed entry', () => {
      expect(
        isIgnored({ filename: '.git/refs/heads/main', ignoredTopLevelEntries })
      ).toBe(true);
    });

    it('drops the listed entry itself', () => {
      expect(isIgnored({ filename: '.git', ignoredTopLevelEntries })).toBe(
        true
      );
    });

    it('drops a listed entry reported with Windows separators', () => {
      expect(
        isIgnored({
          filename: '.git\\refs\\heads\\main',
          ignoredTopLevelEntries,
        })
      ).toBe(true);
    });

    // Everything below would leave a listener stale if it were dropped, so the
    // filter has to stay narrower than "looks hidden".
    it('keeps a document', () => {
      expect(isIgnored({ filename: 'hello.md', ignoredTopLevelEntries })).toBe(
        false
      );
    });

    it('keeps a document under an unrelated hidden directory', () => {
      expect(
        isIgnored({ filename: '.drafts/hello.md', ignoredTopLevelEntries })
      ).toBe(false);
    });

    it('matches whole segments, not prefixes', () => {
      expect(
        isIgnored({ filename: '.gitignore', ignoredTopLevelEntries })
      ).toBe(false);
    });

    it('matches only at the top level', () => {
      expect(
        isIgnored({ filename: 'vendor/.git/index', ignoredTopLevelEntries })
      ).toBe(false);
    });

    it('keeps the watched directory, which events sometimes name', () => {
      expect(
        isIgnored({ filename: 'my-project', ignoredTopLevelEntries })
      ).toBe(false);
    });

    it('keeps an unnamed change, so it is not missed', () => {
      expect(isIgnored({ filename: null, ignoredTopLevelEntries })).toBe(false);
    });

    it('keeps everything when nothing is listed', () => {
      expect(
        isIgnored({ filename: '.git/index', ignoredTopLevelEntries: [] })
      ).toBe(false);
    });
  });
});
