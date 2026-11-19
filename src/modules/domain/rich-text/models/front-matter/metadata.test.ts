import * as Either from 'effect/Either';
import { describe, expect, it } from 'vitest';

import { InvalidMetadataErrorTag } from '../../errors';
import { parseFrontMatter } from './metadata';

const lines = (...textLines: string[]): string => `${textLines.join('\n')}\n`;

describe('parseFrontMatter', () => {
  it('parses single-line text as inlines, quoted or not', () => {
    const frontMatter = lines(
      'title: Hello *world*',
      'subtitle: "With `code` and a [link](https://example.org)"'
    );

    const entries = Either.getOrThrow(parseFrontMatter(frontMatter));

    expect(entries).toEqual([
      { key: 'title', value: { type: 'MetaInlines', source: 'Hello *world*' } },
      {
        key: 'subtitle',
        value: {
          type: 'MetaInlines',
          source: 'With `code` and a [link](https://example.org)',
        },
      },
    ]);
  });

  it('parses a block scalar as blocks', () => {
    const frontMatter = lines(
      'abstract: |',
      '  First paragraph.',
      '',
      '  Second paragraph, with **strong** text.'
    );

    const entries = Either.getOrThrow(parseFrontMatter(frontMatter));

    expect(entries).toEqual([
      {
        key: 'abstract',
        value: {
          type: 'MetaBlocks',
          source:
            'First paragraph.\n\nSecond paragraph, with **strong** text.\n',
        },
      },
    ]);
  });

  it('parses a block scalar without a final newline as inlines', () => {
    const frontMatter = lines('summary: |-', '  One line.');

    const entries = Either.getOrThrow(parseFrontMatter(frontMatter));

    expect(entries).toEqual([
      { key: 'summary', value: { type: 'MetaInlines', source: 'One line.' } },
    ]);
  });

  it('parses unquoted true and false as booleans', () => {
    const frontMatter = lines('draft: true', 'published: false');

    const entries = Either.getOrThrow(parseFrontMatter(frontMatter));

    expect(entries).toEqual([
      { key: 'draft', value: { type: 'MetaBool', value: true } },
      { key: 'published', value: { type: 'MetaBool', value: false } },
    ]);
  });

  it('parses quoted values, numbers and escapes as text', () => {
    const frontMatter = lines(
      'looks_bool: "true"',
      'looks_emphasis: \\*x\\*',
      'looks_number: "1.10"',
      'number: 1.1'
    );

    const entries = Either.getOrThrow(parseFrontMatter(frontMatter));

    expect(entries).toEqual([
      { key: 'looks_bool', value: { type: 'MetaInlines', source: 'true' } },
      {
        key: 'looks_emphasis',
        value: { type: 'MetaInlines', source: '\\*x\\*' },
      },
      { key: 'looks_number', value: { type: 'MetaInlines', source: '1.10' } },
      { key: 'number', value: { type: 'MetaInlines', source: '1.1' } },
    ]);
  });

  it('parses sequences as lists', () => {
    const frontMatter = lines(
      'tags:',
      '- history',
      '- computing',
      'authors:',
      '- name: Ada',
      '- name: Charles'
    );

    const entries = Either.getOrThrow(parseFrontMatter(frontMatter));

    expect(entries).toEqual([
      {
        key: 'tags',
        value: {
          type: 'MetaList',
          items: [
            { type: 'MetaInlines', source: 'history' },
            { type: 'MetaInlines', source: 'computing' },
          ],
        },
      },
      {
        key: 'authors',
        value: {
          type: 'MetaList',
          items: [
            {
              type: 'MetaMap',
              entries: [
                { key: 'name', value: { type: 'MetaInlines', source: 'Ada' } },
              ],
            },
            {
              type: 'MetaMap',
              entries: [
                {
                  key: 'name',
                  value: { type: 'MetaInlines', source: 'Charles' },
                },
              ],
            },
          ],
        },
      },
    ]);
  });

  it('parses mappings as maps, nested ones included', () => {
    const frontMatter = lines(
      'author:',
      '  name: Ada Lovelace',
      '  affiliation:',
      '    name: Analytical Engines',
      '    city: London'
    );

    const entries = Either.getOrThrow(parseFrontMatter(frontMatter));

    expect(entries).toEqual([
      {
        key: 'author',
        value: {
          type: 'MetaMap',
          entries: [
            {
              key: 'name',
              value: { type: 'MetaInlines', source: 'Ada Lovelace' },
            },
            {
              key: 'affiliation',
              value: {
                type: 'MetaMap',
                entries: [
                  {
                    key: 'name',
                    value: {
                      type: 'MetaInlines',
                      source: 'Analytical Engines',
                    },
                  },
                  {
                    key: 'city',
                    value: { type: 'MetaInlines', source: 'London' },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);
  });

  it('keeps the keys in the order the front matter holds them', () => {
    const frontMatter = lines('title: A', 'date: B', 'author: C');

    const entries = Either.getOrThrow(parseFrontMatter(frontMatter));

    expect(entries.map(({ key }) => key)).toEqual(['title', 'date', 'author']);
  });

  it('parses an empty front matter as no entries', () => {
    const entries = Either.getOrThrow(parseFrontMatter(''));

    expect(entries).toEqual([]);
  });

  it.each([
    ['is not valid YAML', lines('title: [unclosed')],
    ['is not a map', lines('- a', '- b')],
    ['has a key that is not text', lines('? [a, b]', ': c')],
    ['has an alias', lines('a: &x b', 'c: *x')],
  ])('fails with an invalid metadata error when it %s', (_, frontMatter) => {
    const error = Either.getOrThrow(Either.flip(parseFrontMatter(frontMatter)));

    expect(error._tag).toBe(InvalidMetadataErrorTag);
  });
});
