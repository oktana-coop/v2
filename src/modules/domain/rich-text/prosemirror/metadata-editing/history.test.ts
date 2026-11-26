import * as Either from 'effect/Either';
import { describe, expect, it } from 'vitest';

import { reverseChange } from './history';

describe('reverseChange', () => {
  it('gives the front matter before the change when nothing changed since', () => {
    const reversed = reverseChange({
      change: { before: 'draft: true\n', after: 'draft: false\n' },
      frontMatter: 'draft: false\n',
    });

    expect(Either.getOrThrow(reversed)).toBe('draft: true\n');
  });

  it('keeps a change made to the front matter since', () => {
    const reversed = reverseChange({
      change: { before: 'draft: true\n', after: 'draft: false\n' },
      frontMatter: 'title: Hello\ndraft: false\n',
    });

    expect(Either.getOrThrow(reversed)).toBe('title: Hello\ndraft: true\n');
  });
});
