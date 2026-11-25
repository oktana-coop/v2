import * as Either from 'effect/Either';
import { describe, expect, it } from 'vitest';

import { InvalidMetadataErrorTag } from '../../errors';
import { mergeFrontMatter } from './front-matter-merge';

const lines = (...textLines: string[]): string => `${textLines.join('\n')}\n`;

describe('mergeFrontMatter', () => {
  it('applies your changes over theirs, keeping theirs', () => {
    const merged = mergeFrontMatter({
      base: lines('title: "Hello"', 'draft: true'),
      yours: lines('title: "Hello"', 'draft: false'),
      theirs: lines('title: "Hi"', 'draft: true'),
    });

    expect(Either.getOrThrow(merged)).toBe(
      lines('title: "Hi"', 'draft: false')
    );
  });

  it('gives your front matter when theirs is still the base', () => {
    const merged = mergeFrontMatter({
      base: lines('title: "Hello"', 'draft: true'),
      yours: lines('title: "Hello"'),
      theirs: lines('title: "Hello"', 'draft: true'),
    });

    expect(Either.getOrThrow(merged)).toBe(lines('title: "Hello"'));
  });

  it('takes no front matter as empty text', () => {
    const merged = mergeFrontMatter({
      base: lines('draft: true'),
      yours: null,
      theirs: lines('draft: true'),
    });

    expect(Either.getOrThrow(merged)).toBe('');
  });

  it("fails with InvalidMetadataError when the result isn't front matter", () => {
    const error = Either.getOrThrow(
      Either.flip(
        mergeFrontMatter({
          base: lines('title: "Hello"'),
          yours: lines('title: "Hello"', 'tags: [unclosed'),
          theirs: lines('title: "Hello"'),
        })
      )
    );

    expect(error._tag).toBe(InvalidMetadataErrorTag);
  });
});
