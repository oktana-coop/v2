import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { PlainTextValidationErrorTag } from '../errors';
import { parsePlainText } from './document';

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

describe('parsePlainText', () => {
  it('accepts text with LF line endings and no byte order mark', async () => {
    const text = await Effect.runPromise(parsePlainText('a: 1\nb: 2\n'));

    expect(text).toBe('a: 1\nb: 2\n');
  });

  it('refuses text with a carriage return', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(parsePlainText('a: 1\r\nb: 2\r\n'))
    );

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
    expect(failure.message).toContain('The text holds a carriage return');
  });

  it('refuses text that starts with a byte order mark', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(parsePlainText(`${BYTE_ORDER_MARK}a: 1\n`))
    );

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
    expect(failure.message).toContain('The text starts with a byte order mark');
  });
});
