import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { describe, expect, it } from 'vitest';

import { PlainTextValidationErrorTag } from '../errors';
import {
  lineEndings,
  normalizeStoredContent,
  parseNormalizedText,
  restoreStoredContent,
} from './stored-format';

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const normalize = (content: string) =>
  Effect.runPromise(normalizeStoredContent(content));

const roundTrip = (content: string) =>
  Effect.runPromise(
    pipe(normalizeStoredContent(content), Effect.map(restoreStoredContent))
  );

describe('parseNormalizedText', () => {
  it('accepts text with LF line endings and no byte order mark', async () => {
    const text = await Effect.runPromise(parseNormalizedText('a: 1\nb: 2\n'));

    expect(text).toBe('a: 1\nb: 2\n');
  });

  it('refuses text with a carriage return', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(parseNormalizedText('a: 1\r\nb: 2\r\n'))
    );

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
    expect(failure.message).toContain('The text holds a carriage return');
  });

  it('refuses text that starts with a byte order mark', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(parseNormalizedText(`${BYTE_ORDER_MARK}a: 1\n`))
    );

    expect(failure._tag).toBe(PlainTextValidationErrorTag);
    expect(failure.message).toContain('The text starts with a byte order mark');
  });
});

describe('normalizeStoredContent', () => {
  it('keeps LF text as it is', async () => {
    const normalized = await normalize('a: 1\nb: 2\n');

    expect(normalized).toEqual({
      text: 'a: 1\nb: 2\n',
      format: { lineEnding: lineEndings.LF, byteOrderMark: false },
    });
  });

  it('turns CRLF line endings into LF and notes them', async () => {
    const normalized = await normalize('a: 1\r\nb: 2\r\n');

    expect(normalized).toEqual({
      text: 'a: 1\nb: 2\n',
      format: { lineEnding: lineEndings.CRLF, byteOrderMark: false },
    });
  });

  it('notes the more common line ending of a file that mixes them', async () => {
    const mostlyCRLF = await normalize('a: 1\r\nb: 2\r\nc: 3\n');
    const mostlyLF = await normalize('a: 1\nb: 2\r\nc: 3\n');

    expect(mostlyCRLF).toEqual({
      text: 'a: 1\nb: 2\nc: 3\n',
      format: { lineEnding: lineEndings.CRLF, byteOrderMark: false },
    });
    expect(mostlyLF.format.lineEnding).toBe(lineEndings.LF);
  });

  it('notes LF for a file with as many of each line ending', async () => {
    const normalized = await normalize('a: 1\r\nb: 2\n');

    expect(normalized.format.lineEnding).toBe(lineEndings.LF);
  });

  it('notes LF for text without line breaks', async () => {
    const singleLine = await normalize('a: 1');
    const empty = await normalize('');

    expect(singleLine).toEqual({
      text: 'a: 1',
      format: { lineEnding: lineEndings.LF, byteOrderMark: false },
    });
    expect(empty.format.lineEnding).toBe(lineEndings.LF);
  });

  it('turns a lone carriage return into LF', async () => {
    const normalized = await normalize('a: 1\rb: 2\n');

    expect(normalized.text).toBe('a: 1\nb: 2\n');
  });

  it('removes a byte order mark and notes it', async () => {
    const normalized = await normalize(`${BYTE_ORDER_MARK}a: 1\r\n`);

    expect(normalized).toEqual({
      text: 'a: 1\n',
      format: { lineEnding: lineEndings.CRLF, byteOrderMark: true },
    });
  });

  it('keeps a byte order mark that does not start the text', async () => {
    const normalized = await normalize(`a: ${BYTE_ORDER_MARK}1`);

    expect(normalized.text).toBe(`a: ${BYTE_ORDER_MARK}1`);
  });
});

describe('restoreStoredContent', () => {
  it('writes the noted line ending and byte order mark back', async () => {
    const text = await Effect.runPromise(parseNormalizedText('a: 1\nb: 2\n'));

    const content = restoreStoredContent({
      text,
      format: { lineEnding: lineEndings.CRLF, byteOrderMark: true },
    });

    expect(content).toBe(`${BYTE_ORDER_MARK}a: 1\r\nb: 2\r\n`);
  });

  it.each([
    'a: 1\nb: 2\n',
    'a: 1\r\nb: 2\r\n',
    `${BYTE_ORDER_MARK}a: 1\r\nb: 2\r\n`,
    `${BYTE_ORDER_MARK}a: 1\n`,
    'a: 1',
    '',
  ])('gives back stored content %j unchanged', async (content) => {
    const restored = await roundTrip(content);

    expect(restored).toBe(content);
  });

  it('writes a file that mixed line endings back with its more common one', async () => {
    const restored = await roundTrip('a: 1\r\nb: 2\r\nc: 3\n');

    expect(restored).toBe('a: 1\r\nb: 2\r\nc: 3\r\n');
  });
});
