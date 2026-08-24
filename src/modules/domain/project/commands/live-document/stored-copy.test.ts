import { describe, expect, it } from 'vitest';

import { rebasedOn, storedCopy } from './stored-copy';

describe('rebasedOn', () => {
  it('keeps the content and anchors in the new document', () => {
    const opened = storedCopy({ content: 'hello', base: '1' });

    expect(rebasedOn('9')(opened)).toEqual({ content: 'hello', base: '9' });
  });
});
