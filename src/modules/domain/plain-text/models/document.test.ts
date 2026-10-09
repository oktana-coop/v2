import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { PlainTextValidationErrorTag } from '../errors';
import { parsePlainTextDocument } from './document';

const encode = (text: string) => new TextEncoder().encode(text);

const parse = (bytes: Uint8Array) =>
  Effect.runPromise(parsePlainTextDocument(bytes));

const parseFailure = (bytes: Uint8Array) =>
  Effect.runPromise(Effect.flip(parsePlainTextDocument(bytes)));

describe('parsePlainTextDocument', () => {
  it('reads UTF-8 text', async () => {
    const document = await parse(encode('name: café ☕'));

    expect(document).toEqual({ content: 'name: café ☕' });
  });

  it('reads an empty file as empty text', async () => {
    const document = await parse(new Uint8Array());

    expect(document).toEqual({ content: '' });
  });

  it('keeps line endings as stored', async () => {
    const document = await parse(encode('a: 1\r\nb: 2\r\n'));

    expect(document).toEqual({ content: 'a: 1\r\nb: 2\r\n' });
  });

  it('keeps a byte order mark', async () => {
    const document = await parse(
      new Uint8Array([0xef, 0xbb, 0xbf, ...encode('a: 1')])
    );

    expect(document).toEqual({ content: '\uFEFFa: 1' });
  });

  it('refuses invalid UTF-8', async () => {
    const failure = await parseFailure(new Uint8Array([0x61, 0xff, 0x62]));

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
    expect(failure.message).toBe('The content is not valid UTF-8');
  });

  it('refuses a NUL byte', async () => {
    const failure = await parseFailure(new Uint8Array([0x61, 0x00, 0x62]));

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
    expect(failure.message).toBe('The content holds a NUL byte');
  });

  it('refuses a PNG file', async () => {
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);

    const failure = await parseFailure(pngHeader);

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
  });
});
