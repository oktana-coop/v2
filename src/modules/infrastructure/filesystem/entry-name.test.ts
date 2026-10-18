import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { describe, expect, it } from 'vitest';

import { parseEntryNameEffect } from './entry-name';
import { FilesystemValidationErrorTag } from './errors';

// The message the name is refused with, or null when it is accepted.
const errorMessage = (name: string): string | null =>
  Either.match(Effect.runSync(Effect.either(parseEntryNameEffect(name))), {
    onLeft: (error) => {
      expect(error._tag).toBe(FilesystemValidationErrorTag);
      return error.message;
    },
    onRight: () => null,
  });

describe('parseEntryNameEffect', () => {
  it.each([
    'notes',
    'notes.md',
    'my notes.md',
    'v1.2',
    'archive.tar.gz',
    '.gitignore',
    'console.md',
    'com10.md',
    'COM0.md',
    'conin.md',
    'my-con.md',
  ])('accepts %j', (name) => {
    expect(errorMessage(name)).toBeNull();
  });

  it('refuses an empty name', () => {
    expect(errorMessage('')).toBe('Enter a name');
  });

  it.each(['drafts/notes.md', 'drafts\\notes.md', '../notes.md'])(
    'refuses %j, which contains a path separator',
    (name) => {
      expect(errorMessage(name)).toMatch(/cannot contain \/ or \\/);
    }
  );

  it.each(['.', '..'])('refuses %j', (name) => {
    expect(errorMessage(name)).toMatch(/cannot be used as names/);
  });

  it.each([
    'a<b.md',
    'a>b.md',
    'a:b.md',
    'a"b.md',
    'a|b.md',
    'a?b.md',
    'a*b.md',
    'a\tb.md',
    'a\u0000b.md',
  ])('refuses %j, which contains a character Windows refuses', (name) => {
    expect(errorMessage(name)).toMatch(/control characters/);
  });

  it.each(['notes.', 'notes.md '])(
    'refuses %j, which ends with a dot or a space',
    (name) => {
      expect(errorMessage(name)).toMatch(/end with a dot or a space/);
    }
  );

  it.each([
    'con',
    'CON.md',
    'nul.txt',
    'Com1.yaml',
    'lpt9',
    'aux.tar.gz',
    'COM¹.md',
    'lpt³',
    'conin$.md',
    'CONOUT$',
  ])('refuses %j, a name Windows reserves', (name) => {
    expect(errorMessage(name)).toMatch(/reserved on Windows/);
  });

  it.each(['CON .md', 'com1 . .md', 'nul  .txt'])(
    'refuses %j, a reserved name once Windows drops the spaces before the dot',
    (name) => {
      expect(errorMessage(name)).toMatch(/reserved on Windows/);
    }
  );

  it.each([
    ['ASCII', 'a'.repeat(252) + '.md'],
    ['two-byte characters', 'é'.repeat(126) + '.md'],
  ])('accepts a %s name of 255 UTF-8 bytes', (_, name) => {
    expect(errorMessage(name)).toBeNull();
  });

  it.each([
    ['ASCII', 'a'.repeat(253) + '.md'],
    ['two-byte characters', 'é'.repeat(127) + '.md'],
  ])('refuses a %s name over 255 UTF-8 bytes', (_, name) => {
    expect(errorMessage(name)).toBe('This name is too long');
  });

  it('normalizes the name to its composed form', () => {
    // café.md: given as `e` plus a combining accent, expected as a single `é`.
    const decomposed = 'cafe\u0301.md';

    const name = Effect.runSync(parseEntryNameEffect(decomposed));

    expect(name).toBe('caf\u00e9.md');
  });
});
