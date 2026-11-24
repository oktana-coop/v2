import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import { describe, expect, it } from 'vitest';

import {
  InvalidMetadataErrorTag,
  InvalidMetadataKeyErrorTag,
} from '../../errors';
import { type MetadataValue, parseFrontMatter } from './metadata';
import { applyMetadataEdit } from './metadata-edits';

const lines = (...textLines: string[]): string => `${textLines.join('\n')}\n`;

const textList = (...sources: string[]): MetadataValue => ({
  type: 'MetaList',
  items: sources.map((source) => ({ type: 'MetaInlines', source })),
});

// The entries the edited front matter reads as.
const entriesOf = (edited: ReturnType<typeof applyMetadataEdit>) =>
  Either.getOrThrow(pipe(edited, Either.flatMap(parseFrontMatter)));

describe('applyMetadataEdit', () => {
  describe('setBoolean', () => {
    it('sets a boolean, keeping the other keys and their order', () => {
      const frontMatter = lines(
        'title: Hello',
        'draft: true',
        'abstract: |',
        '  First paragraph.',
        '',
        '  Second paragraph.'
      );

      const edited = applyMetadataEdit({
        frontMatter,
        edit: { type: 'setBoolean', key: 'draft', value: false },
      });

      expect(Either.getOrThrow(edited)).toBe(
        lines(
          'title: Hello',
          'draft: false',
          'abstract: |',
          '  First paragraph.',
          '',
          '  Second paragraph.'
        )
      );
    });

    it('writes a boolean the front matter reads as one', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: Hello'),
        edit: { type: 'setBoolean', key: 'draft', value: true },
      });

      expect(entriesOf(edited)).toEqual([
        { key: 'title', value: { type: 'MetaInlines', source: 'Hello' } },
        { key: 'draft', value: { type: 'MetaBool', value: true } },
      ]);
    });

    it('adds the key when the front matter no longer has it', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: Hello'),
        edit: { type: 'setBoolean', key: 'draft', value: false },
      });

      expect(Either.getOrThrow(edited)).toBe(
        lines('title: Hello', 'draft: false')
      );
    });

    it('starts the front matter when the document has none', () => {
      const edited = applyMetadataEdit({
        frontMatter: null,
        edit: { type: 'setBoolean', key: 'draft', value: true },
      });

      expect(Either.getOrThrow(edited)).toBe(lines('draft: true'));
    });

    it("fails with InvalidMetadataError when the front matter isn't valid YAML", () => {
      const error = Either.getOrThrow(
        Either.flip(
          applyMetadataEdit({
            frontMatter: lines('title: [unclosed'),
            edit: { type: 'setBoolean', key: 'draft', value: true },
          })
        )
      );

      expect(error._tag).toBe(InvalidMetadataErrorTag);
    });
  });

  describe('setInlines', () => {
    it('merges the text with a change made to it since its base', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: A short essay title'),
        edit: {
          type: 'setInlines',
          key: 'title',
          base: 'A short title',
          value: 'A shorter title',
        },
      });

      expect(Either.getOrThrow(edited)).toBe(
        lines('title: "A shorter essay title"')
      );
    });

    it('writes text that reads as text, whatever it holds', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: Hello'),
        edit: {
          type: 'setInlines',
          key: 'title',
          base: 'Hello',
          value: 'yes',
        },
      });

      expect(Either.getOrThrow(edited)).toBe(lines('title: "yes"'));
    });

    it('adds the key back when the front matter no longer has it', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('draft: true'),
        edit: { type: 'setInlines', key: 'title', base: 'Old', value: 'New' },
      });

      expect(Either.getOrThrow(edited)).toBe(
        lines('draft: true', 'title: "New"')
      );
    });

    it('replaces a value that is no longer text', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title:', '- a'),
        edit: { type: 'setInlines', key: 'title', base: 'Old', value: 'New' },
      });

      expect(Either.getOrThrow(edited)).toBe(lines('title: "New"'));
    });
  });

  describe('setBlocks', () => {
    it('writes a literal block ending in a newline', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('abstract: |', '  First.'),
        edit: {
          type: 'setBlocks',
          key: 'abstract',
          base: 'First.\n',
          value: 'First.\n\nSecond.',
        },
      });

      expect(Either.getOrThrow(edited)).toBe(
        lines('abstract: |', '  First.', '', '  Second.')
      );
    });

    it('merges the text with a change made to it since its base', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('abstract: |', '  First, edited.', '', '  Second.'),
        edit: {
          type: 'setBlocks',
          key: 'abstract',
          base: 'First.\n\nSecond.\n',
          value: 'First.\n\nSecond, edited.',
        },
      });

      expect(Either.getOrThrow(edited)).toBe(
        lines('abstract: |', '  First, edited.', '', '  Second, edited.')
      );
    });
  });

  describe('addListItem', () => {
    it('adds the item after the ones the list holds', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('tags:', '- history'),
        edit: { type: 'addListItem', key: 'tags', item: 'computing' },
      });

      expect(entriesOf(edited)).toEqual([
        { key: 'tags', value: textList('history', 'computing') },
      ]);
    });

    it('starts a list when the front matter no longer has the key', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: Hello'),
        edit: { type: 'addListItem', key: 'tags', item: 'history' },
      });

      expect(entriesOf(edited)).toEqual([
        { key: 'title', value: { type: 'MetaInlines', source: 'Hello' } },
        { key: 'tags', value: textList('history') },
      ]);
    });
  });

  describe('removeListItem', () => {
    it('removes the first item equal to it', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('tags:', '- a', '- b', '- a'),
        edit: { type: 'removeListItem', key: 'tags', item: 'a' },
      });

      expect(entriesOf(edited)).toEqual([
        { key: 'tags', value: textList('b', 'a') },
      ]);
    });

    it('leaves the list as it is when the item is no longer in it', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('tags:', '- a'),
        edit: { type: 'removeListItem', key: 'tags', item: 'b' },
      });

      expect(entriesOf(edited)).toEqual([
        { key: 'tags', value: textList('a') },
      ]);
    });
  });

  describe('renameKey', () => {
    it('renames the key in place, keeping its value', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: Hello', 'draft: true', 'tags:', '- a'),
        edit: { type: 'renameKey', key: 'draft', newKey: 'published' },
      });

      expect(entriesOf(edited)).toEqual([
        { key: 'title', value: { type: 'MetaInlines', source: 'Hello' } },
        { key: 'published', value: { type: 'MetaBool', value: true } },
        { key: 'tags', value: textList('a') },
      ]);
    });

    it('writes a key that reads as text, whatever it holds', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: Hello'),
        edit: { type: 'renameKey', key: 'title', newKey: 'true' },
      });

      expect(Either.getOrThrow(edited)).toBe(lines('"true": Hello'));
    });

    it('leaves the front matter as it is when the key is gone', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: Hello'),
        edit: { type: 'renameKey', key: 'draft', newKey: 'published' },
      });

      expect(Either.getOrThrow(edited)).toBe(lines('title: Hello'));
    });

    it.each([
      ['another key has', 'title', { type: 'alreadyExists', key: 'title' }],
      ['is empty', '', { type: 'empty' }],
      ['ends in _', 'subtitle_', { type: 'endsInUnderscore' }],
    ])(
      'fails with InvalidMetadataKeyError for a new name that %s, and why',
      (_, newKey, reason) => {
        const error = Either.getOrThrow(
          Either.flip(
            applyMetadataEdit({
              frontMatter: lines('title: Hello', 'subtitle: World'),
              edit: { type: 'renameKey', key: 'subtitle', newKey },
            })
          )
        );

        expect(error).toMatchObject({
          _tag: InvalidMetadataKeyErrorTag,
          data: { reason },
        });
      }
    );
  });

  describe('removeKey', () => {
    it('removes the key and its value', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: Hello', 'draft: true'),
        edit: { type: 'removeKey', key: 'draft' },
      });

      expect(Either.getOrThrow(edited)).toBe(lines('title: Hello'));
    });

    it('leaves the front matter as it is when the key is gone', () => {
      const edited = applyMetadataEdit({
        frontMatter: lines('title: Hello'),
        edit: { type: 'removeKey', key: 'draft' },
      });

      expect(Either.getOrThrow(edited)).toBe(lines('title: Hello'));
    });
  });
});
