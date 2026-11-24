import * as Either from 'effect/Either';
import { describe, expect, it } from 'vitest';

import { InvalidMetadataErrorTag } from '../../errors';
import { parseFrontMatter } from './metadata';
import { applyMetadataEdit } from './metadata-edits';

const lines = (...textLines: string[]): string => `${textLines.join('\n')}\n`;

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

      expect(
        Either.getOrThrow(Either.flatMap(edited, parseFrontMatter))
      ).toEqual([
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
});
