import { describe, expect, it } from 'vitest';

import { rebasedOn, storedCopy } from './stored-copy';

describe('rebasedOn', () => {
  it('replaces the base, keeping the document', () => {
    const stored = storedCopy({ document: 'hello', base: 'v1' });

    expect(rebasedOn('v2')(stored)).toEqual({ document: 'hello', base: 'v2' });
  });
});
