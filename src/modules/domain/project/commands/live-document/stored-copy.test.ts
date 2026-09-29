import { describe, expect, it } from 'vitest';

import { rebasedOn, storedCopy } from './stored-copy';

describe('rebasedOn', () => {
  it('replaces the base, keeping the content', () => {
    const stored = storedCopy({ content: 'hello', base: 'v1' });

    expect(rebasedOn('v2')(stored)).toEqual({ content: 'hello', base: 'v2' });
  });
});
