import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { describe, expect, it } from 'vitest';

import { PlainTextValidationErrorTag } from '../errors';
import { parsePlainText } from './document';
import {
  lineEndings,
  parseRawPlainText,
  plainTextToRawPlainText,
  rawPlainTextToPlainText,
} from './raw-plain-text';

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const encode = (text: string) => new TextEncoder().encode(text);

const parse = (bytes: Uint8Array) =>
  Effect.runPromise(parseRawPlainText(bytes));

const parseFailure = (bytes: Uint8Array) =>
  Effect.runPromise(Effect.flip(parseRawPlainText(bytes)));

const rawToPlain = (content: string) =>
  Effect.runPromise(rawPlainTextToPlainText({ content }));

const roundTrip = (content: string) =>
  Effect.runPromise(
    pipe(
      rawPlainTextToPlainText({ content }),
      Effect.map(plainTextToRawPlainText),
      Effect.map((raw) => raw.content)
    )
  );

describe('parseRawPlainText', () => {
  it('reads UTF-8 text', async () => {
    const document = await parse(encode('name: café ☕'));

    expect(document).toEqual({ content: 'name: café ☕' });
  });

  it('reads an empty file as empty text', async () => {
    const document = await parse(new Uint8Array());

    expect(document).toEqual({ content: '' });
  });

  it('keeps line endings as they are', async () => {
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
    expect(failure.message).toContain('The content is not valid UTF-8');
  });

  it('refuses a NUL byte', async () => {
    const failure = await parseFailure(new Uint8Array([0x61, 0x00, 0x62]));

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
    expect(failure.message).toContain('The content holds a NUL byte');
  });

  it('refuses a PNG file', async () => {
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);

    const failure = await parseFailure(pngHeader);

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
  });
});

describe('rawPlainTextToPlainText', () => {
  it('keeps LF text as it is', async () => {
    const plain = await rawToPlain('a: 1\nb: 2\n');

    expect(plain).toEqual({
      text: 'a: 1\nb: 2\n',
      format: { lineEnding: lineEndings.LF, byteOrderMark: false },
    });
  });

  it('turns CRLF line endings into LF and notes them', async () => {
    const plain = await rawToPlain('a: 1\r\nb: 2\r\n');

    expect(plain).toEqual({
      text: 'a: 1\nb: 2\n',
      format: { lineEnding: lineEndings.CRLF, byteOrderMark: false },
    });
  });

  it('notes the more common line ending of a file that mixes them', async () => {
    const mostlyCRLF = await rawToPlain('a: 1\r\nb: 2\r\nc: 3\n');
    const mostlyLF = await rawToPlain('a: 1\nb: 2\r\nc: 3\n');

    expect(mostlyCRLF).toEqual({
      text: 'a: 1\nb: 2\nc: 3\n',
      format: { lineEnding: lineEndings.CRLF, byteOrderMark: false },
    });
    expect(mostlyLF.format.lineEnding).toBe(lineEndings.LF);
  });

  it('notes LF for a file with as many of each line ending', async () => {
    const plain = await rawToPlain('a: 1\r\nb: 2\n');

    expect(plain.format.lineEnding).toBe(lineEndings.LF);
  });

  it('notes LF for text without line breaks', async () => {
    const singleLine = await rawToPlain('a: 1');
    const empty = await rawToPlain('');

    expect(singleLine).toEqual({
      text: 'a: 1',
      format: { lineEnding: lineEndings.LF, byteOrderMark: false },
    });
    expect(empty.format.lineEnding).toBe(lineEndings.LF);
  });

  it('turns a lone carriage return into LF', async () => {
    const plain = await rawToPlain('a: 1\rb: 2\n');

    expect(plain.text).toBe('a: 1\nb: 2\n');
  });

  it('removes a byte order mark and notes it', async () => {
    const plain = await rawToPlain(`${BYTE_ORDER_MARK}a: 1\r\n`);

    expect(plain).toEqual({
      text: 'a: 1\n',
      format: { lineEnding: lineEndings.CRLF, byteOrderMark: true },
    });
  });

  it('keeps a byte order mark that does not start the text', async () => {
    const plain = await rawToPlain(`a: ${BYTE_ORDER_MARK}1`);

    expect(plain.text).toBe(`a: ${BYTE_ORDER_MARK}1`);
  });
});

describe('plainTextToRawPlainText', () => {
  it('writes the noted line ending and byte order mark back', async () => {
    const text = await Effect.runPromise(parsePlainText('a: 1\nb: 2\n'));

    const raw = plainTextToRawPlainText({
      text,
      format: { lineEnding: lineEndings.CRLF, byteOrderMark: true },
    });

    expect(raw).toEqual({ content: `${BYTE_ORDER_MARK}a: 1\r\nb: 2\r\n` });
  });

  it.each([
    'a: 1\nb: 2\n',
    'a: 1\r\nb: 2\r\n',
    `${BYTE_ORDER_MARK}a: 1\r\nb: 2\r\n`,
    `${BYTE_ORDER_MARK}a: 1\n`,
    'a: 1',
    '',
  ])('gives back raw plain text %j unchanged', async (content) => {
    const restored = await roundTrip(content);

    expect(restored).toBe(content);
  });

  it('writes a file that mixed line endings back with its more common one', async () => {
    const restored = await roundTrip('a: 1\r\nb: 2\r\nc: 3\n');

    expect(restored).toBe('a: 1\r\nb: 2\r\nc: 3\r\n');
  });
});
