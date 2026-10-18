import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { changesBetween } from './text-changes';

describe('changesBetween', () => {
  it('is empty for equal texts', () => {
    expect(changesBetween({ before: 'hello', after: 'hello' })).toEqual([]);
  });

  it('handles a single word insertion', () => {
    expect(
      changesBetween({ before: 'hello world', after: 'hello big world' })
    ).toEqual([{ from: 6, to: 6, insert: 'big ' }]);
  });

  it('handles a single word deletion', () => {
    expect(
      changesBetween({ before: 'hello big world', after: 'hello world' })
    ).toEqual([{ from: 6, to: 10, insert: '' }]);
  });

  it('handles a single word replacement', () => {
    expect(changesBetween({ before: 'hello cat', after: 'hello dog' })).toEqual(
      [{ from: 6, to: 9, insert: 'dog' }]
    );
  });

  it('handles a single line deletion', () => {
    expect(
      changesBetween({
        before: 'first\nsecond\nthird\n',
        after: 'first\nthird\n',
      })
    ).toEqual([{ from: 6, to: 13, insert: '' }]);
  });

  it('keeps edits in separate places as separate changes', () => {
    expect(
      changesBetween({
        before: 'first\nmiddle\nlast',
        after: 'first line\nmiddle\nlast line',
      })
    ).toEqual([
      { from: 5, to: 5, insert: ' line' },
      // The end of `last` is at 17 in the first text; the first ` line` adds
      // five characters before it, so it is at 22 in the second.
      { from: 17, to: 17, insert: ' line' },
    ]);
  });

  it('gives positions in the first text, not shifted by earlier changes', () => {
    expect(
      changesBetween({
        before: 'name: v2\nversion: 1.2\n',
        after: 'name: v10\nversion: 1.4\n',
      })
    ).toEqual([
      { from: 7, to: 8, insert: '10' },
      // The version's last digit is at 20 in the first text; `v10` is one
      // character longer than `v2`, so it is at 21 in the second.
      { from: 20, to: 21, insert: '4' },
    ]);
  });

  it('replaces the whole text when nothing is in common', () => {
    expect(changesBetween({ before: 'abc', after: 'xyz' })).toEqual([
      { from: 0, to: 3, insert: 'xyz' },
    ]);
  });

  it('deletes everything when the second text is empty', () => {
    expect(changesBetween({ before: 'name: v2\n', after: '' })).toEqual([
      { from: 0, to: 9, insert: '' },
    ]);
  });

  it('inserts everything when the first text is empty', () => {
    expect(changesBetween({ before: '', after: 'name: v2\n' })).toEqual([
      { from: 0, to: 0, insert: 'name: v2\n' },
    ]);
  });

  it('does not split a surrogate pair', () => {
    // Both emoji share their high surrogate.
    expect(changesBetween({ before: 'a😀b', after: 'a😃b' })).toEqual([
      { from: 1, to: 3, insert: '😃' },
    ]);
  });

  it('replaces whole emoji', () => {
    expect(
      changesBetween({ before: 'mood: 😀 today', after: 'mood: 🎉 today' })
    ).toEqual([{ from: 6, to: 8, insert: '🎉' }]);
  });

  describe('with differences on every other character', () => {
    const before = 'a1b2c3d4e5f6g7h8i9j0';
    const after = 'aXbYcZdWeVfUgThSiRjQ';

    it('covers each difference on its own', () => {
      expect(changesBetween({ before, after })).toHaveLength(10);
    });

    it('falls back to one coarser change when the diff runs out of time', () => {
      // @codemirror/merge's diff notes the time when it starts and, once 50 ms
      // have passed, falls back by itself to replacing what remains in one go;
      // here, a whole second passes before it next looks at the clock.
      const now = vi
        .spyOn(Date, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValue(1_000);
      onTestFinished(() => {
        now.mockRestore();
      });

      expect(changesBetween({ before, after })).toEqual([
        { from: 1, to: 20, insert: 'XbYcZdWeVfUgThSiRjQ' },
      ]);
    });
  });
});
