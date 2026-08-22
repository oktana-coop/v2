import { describe, expect, it } from 'vitest';

import {
  holdsContent,
  mayWrite,
  nowHolding,
  rebasedOn,
  storedCopy,
  writeCancelled,
} from './stored-copy';

const opened = storedCopy({ content: 'hello', version: '1' });

describe('holdsContent', () => {
  it('recognizes content the store already holds', () => {
    expect(holdsContent({ stored: opened, content: 'hello' })).toBe(true);
    expect(holdsContent({ stored: opened, content: 'hello world' })).toBe(
      false
    );
  });

  it('follows what was last written or read', () => {
    const written = nowHolding({
      stored: opened,
      content: 'hello world',
      version: '2',
    });

    expect(holdsContent({ stored: written, content: 'hello world' })).toBe(
      true
    );
    expect(holdsContent({ stored: written, content: 'hello' })).toBe(false);
  });
});

describe('mayWrite', () => {
  it('allows any version until one is cancelled', () => {
    expect(mayWrite({ stored: opened, version: '1' })).toBe(true);
  });

  it('refuses the cancelled version, and only that one', () => {
    const cancelled = writeCancelled({ stored: opened, version: '2' });

    expect(mayWrite({ stored: cancelled, version: '2' })).toBe(false);
    expect(mayWrite({ stored: cancelled, version: '3' })).toBe(true);
  });
});

describe('nowHolding', () => {
  it('takes the content and the version it derives from', () => {
    expect(
      nowHolding({ stored: opened, content: 'typed', version: '2' })
    ).toMatchObject({ content: 'typed', version: '2' });
  });

  it('leaves a cancelled version standing', () => {
    const cancelled = writeCancelled({ stored: opened, version: '2' });
    const written = nowHolding({
      stored: cancelled,
      content: 'typed',
      version: '3',
    });

    expect(mayWrite({ stored: written, version: '2' })).toBe(false);
  });
});

describe('rebasedOn', () => {
  it('keeps the content and takes the new document version', () => {
    expect(rebasedOn({ stored: opened, version: '9' })).toMatchObject({
      content: 'hello',
      version: '9',
    });
  });

  it('drops a cancellation, which said nothing about this document', () => {
    const cancelled = writeCancelled({ stored: opened, version: '2' });

    expect(
      mayWrite({
        stored: rebasedOn({ stored: cancelled, version: '9' }),
        version: '2',
      })
    ).toBe(true);
  });
});
