import { describe, expect, it } from 'vitest';

import {
  hasMergeConflictMarkers,
  type MergeConflictRegion,
  mergeConflictResolutions,
  type MergeConflictSide,
  parseMergeConflictRegions,
  resolveMergeConflictRegion,
} from './merge-conflict-markers';

const conflictedText = [
  'name: v2',
  '<<<<<<< main',
  'version: 1.29',
  '=======',
  'version: 1.25',
  '>>>>>>> experiment',
  'tags: [editor]',
  '',
].join('\n');

const sideText = ({
  text,
  side,
}: {
  text: string;
  side: MergeConflictSide | null;
}) => (side === null ? null : text.slice(side.from, side.to));

const regionText = ({
  text,
  region,
}: {
  text: string;
  region: MergeConflictRegion;
}) => text.slice(region.from, region.to);

describe('parseMergeConflictRegions', () => {
  it('finds a marked region, its sides and their labels', () => {
    const [region, ...others] = parseMergeConflictRegions(conflictedText);

    expect(others).toEqual([]);
    expect(regionText({ text: conflictedText, region })).toBe(
      '<<<<<<< main\nversion: 1.29\n=======\nversion: 1.25\n>>>>>>> experiment\n'
    );
    expect(sideText({ text: conflictedText, side: region.target })).toBe(
      'version: 1.29\n'
    );
    expect(sideText({ text: conflictedText, side: region.source })).toBe(
      'version: 1.25\n'
    );
    expect(region.base).toBeNull();
    expect(region.target.label).toBe('main');
    expect(region.source.label).toBe('experiment');
  });

  it('finds every region, in order', () => {
    const text = [
      '<<<<<<< main',
      'a: 1',
      '=======',
      'a: 2',
      '>>>>>>> experiment',
      'b: 0',
      '<<<<<<< main',
      'c: 1',
      '=======',
      'c: 2',
      '>>>>>>> experiment',
      '',
    ].join('\n');

    const regions = parseMergeConflictRegions(text);

    expect(
      regions.map((region) => sideText({ text, side: region.target }))
    ).toEqual(['a: 1\n', 'c: 1\n']);
  });

  it('finds the common ancestor side of a region marked with one', () => {
    const text = [
      '<<<<<<< main',
      'version: 1.29',
      '||||||| base',
      'version: 1.2',
      '=======',
      'version: 1.25',
      '>>>>>>> experiment',
      '',
    ].join('\n');

    const [region] = parseMergeConflictRegions(text);

    expect(sideText({ text, side: region.target })).toBe('version: 1.29\n');
    expect(sideText({ text, side: region.base })).toBe('version: 1.2\n');
    expect(sideText({ text, side: region.source })).toBe('version: 1.25\n');
    expect(region.base?.label).toBe('base');
  });

  it('finds sides with no lines', () => {
    const text = '<<<<<<< main\n=======\nversion: 1.25\n>>>>>>> experiment\n';

    const [region] = parseMergeConflictRegions(text);

    expect(sideText({ text, side: region.target })).toBe('');
    expect(sideText({ text, side: region.source })).toBe('version: 1.25\n');
  });

  it('finds a region at the end of a text with no final line break', () => {
    const text =
      'name: v2\n<<<<<<< main\na: 1\n=======\na: 2\n>>>>>>> experiment';

    const [region] = parseMergeConflictRegions(text);

    expect(region.to).toBe(text.length);
    expect(sideText({ text, side: region.source })).toBe('a: 2\n');
  });

  it('finds markers without labels', () => {
    const text = '<<<<<<<\na: 1\n=======\na: 2\n>>>>>>>\n';

    const [region] = parseMergeConflictRegions(text);

    expect(region.target.label).toBe('');
    expect(region.source.label).toBe('');
  });

  it('finds a region in a text with \\r\\n line breaks, keeping them in its sides', () => {
    const text =
      'name: v2\r\n<<<<<<< main\r\nversion: 1.29\r\n=======\r\nversion: 1.25\r\n>>>>>>> experiment\r\n';

    const [region] = parseMergeConflictRegions(text);

    expect(regionText({ text, region })).toBe(
      '<<<<<<< main\r\nversion: 1.29\r\n=======\r\nversion: 1.25\r\n>>>>>>> experiment\r\n'
    );
    expect(sideText({ text, side: region.target })).toBe('version: 1.29\r\n');
    expect(sideText({ text, side: region.source })).toBe('version: 1.25\r\n');
    expect(region.target.label).toBe('main');
    expect(region.source.label).toBe('experiment');
  });

  it('finds no region whose markers were partly edited away', () => {
    expect(
      parseMergeConflictRegions(
        '<<<<<<< main\na: 1\na: 2\n>>>>>>> experiment\n'
      )
    ).toEqual([]);
    expect(
      parseMergeConflictRegions('<<<<<<< main\na: 1\n=======\na: 2\n')
    ).toEqual([]);
    expect(
      parseMergeConflictRegions('a: 1\n=======\na: 2\n>>>>>>> experiment\n')
    ).toEqual([]);
  });

  it('starts over at a start marker within a region', () => {
    const text = [
      '<<<<<<< main',
      'a: 1',
      '<<<<<<< main',
      'b: 1',
      '=======',
      'b: 2',
      '>>>>>>> experiment',
      '',
    ].join('\n');

    const [region, ...others] = parseMergeConflictRegions(text);

    expect(others).toEqual([]);
    expect(sideText({ text, side: region.target })).toBe('b: 1\n');
  });

  it('takes lines that only look like markers as text', () => {
    const text = [
      '<<<<<<<< main',
      '<<<<<<<main',
      '========',
      '>>>>>>>> experiment',
      '',
    ].join('\n');

    expect(parseMergeConflictRegions(text)).toEqual([]);
  });

  it('finds no region in a text without markers', () => {
    expect(parseMergeConflictRegions('name: v2\n')).toEqual([]);
    expect(parseMergeConflictRegions('')).toEqual([]);
  });
});

describe('resolveMergeConflictRegion', () => {
  const [region] = parseMergeConflictRegions(conflictedText);

  it("keeps the target's lines", () => {
    expect(
      resolveMergeConflictRegion({
        text: conflictedText,
        region,
        resolution: mergeConflictResolutions.MERGE_TARGET,
      })
    ).toBe('version: 1.29\n');
  });

  it("keeps the source's lines", () => {
    expect(
      resolveMergeConflictRegion({
        text: conflictedText,
        region,
        resolution: mergeConflictResolutions.MERGE_SOURCE,
      })
    ).toBe('version: 1.25\n');
  });

  it("keeps both sides' lines, the target's first", () => {
    expect(
      resolveMergeConflictRegion({
        text: conflictedText,
        region,
        resolution: mergeConflictResolutions.BOTH,
      })
    ).toBe('version: 1.29\nversion: 1.25\n');
  });
});

describe('hasMergeConflictMarkers', () => {
  it('is true while a start or an end marker line remains', () => {
    expect(hasMergeConflictMarkers(conflictedText)).toBe(true);
    expect(hasMergeConflictMarkers('a: 1\n<<<<<<< main\na: 2\n')).toBe(true);
    expect(hasMergeConflictMarkers('a: 1\n>>>>>>>\n')).toBe(true);
    expect(hasMergeConflictMarkers('a: 1\r\n>>>>>>>\r\n')).toBe(true);
  });

  it('is false once none remains, separator lines included', () => {
    expect(hasMergeConflictMarkers('name: v2\n=======\n')).toBe(false);
    expect(hasMergeConflictMarkers('a: <<<<<<< main\n')).toBe(false);
  });
});
