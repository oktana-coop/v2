import type { ValueOf } from 'type-fest';

import { mergePoles } from './merge-poles';

// The lines of one side of a marked region, line breaks included, and the
// label its marker line carries (a branch name, for example).
export type MergeConflictSide = {
  from: number;
  to: number;
  label: string;
};

// A region of text marked by a merge as conflicting, from the start of its
// `<<<<<<<` line to the end of its `>>>>>>>` line, line break included. A
// merge marks the target's side first.
export type MergeConflictRegion = {
  from: number;
  to: number;
  target: MergeConflictSide;
  base: MergeConflictSide | null;
  source: MergeConflictSide;
};

export const mergeConflictResolutions = {
  ...mergePoles,
  BOTH: 'BOTH',
} as const;

export type MergeConflictResolution = ValueOf<typeof mergeConflictResolutions>;

const START_MARKER = '<<<<<<<';
const BASE_MARKER = '|||||||';
const SEPARATOR = '=======';
const END_MARKER = '>>>>>>>';

// A marker line's text: the marker, then optionally a space and a label.
type MarkerLineText<Marker extends string> = Marker | `${Marker} ${string}`;

// Curried, since a type predicate can only name a positional parameter.
const isMarkerLine =
  <Marker extends string>(marker: Marker) =>
  (line: string): line is MarkerLineText<Marker> =>
    line === marker || line.startsWith(`${marker} `);

const labelOf = <Marker extends string>({
  marker,
  line,
}: {
  marker: Marker;
  line: MarkerLineText<Marker>;
}): string => line.slice(marker.length + 1);

type Line = { text: string; from: number; to: number };

// Each line's offsets, line break included, and its text without the line
// break, \n or \r\n. The empty line after a final line break is left out.
const splitLines = (text: string): Line[] =>
  Array.from(text.matchAll(/[^\n]*\n|[^\n]+$/g), (match) => ({
    text: match[0].replace(/\r?\n$/, ''),
    from: match.index,
    to: match.index + match[0].length,
  }));

type MarkerLine = Line & { label: string };

// A region whose end marker is still to come, by the side being parsed, with
// the marker lines parsed before it.
type OpenRegionTargetState = { side: 'target'; start: MarkerLine };
type OpenRegionBaseState = {
  side: 'base';
  start: MarkerLine;
  base: MarkerLine;
};
type OpenRegionSourceState = {
  side: 'source';
  start: MarkerLine;
  base: MarkerLine | null;
  separator: Line;
};
type OpenRegion =
  OpenRegionTargetState | OpenRegionBaseState | OpenRegionSourceState;

// The complete regions parsed, and the one being parsed, if any.
type RegionsParseState = {
  complete: MergeConflictRegion[];
  open: OpenRegion | null;
};

const completeRegion = ({
  open: { start, base, separator },
  end,
}: {
  open: OpenRegionSourceState;
  end: MarkerLine;
}): MergeConflictRegion => ({
  from: start.from,
  to: end.to,
  target: { from: start.to, to: (base ?? separator).from, label: start.label },
  base:
    base === null
      ? null
      : { from: base.to, to: separator.from, label: base.label },
  source: { from: separator.to, to: end.from, label: end.label },
});

const parseLineWhileInTarget = ({
  complete,
  open,
  line,
}: {
  complete: MergeConflictRegion[];
  open: OpenRegionTargetState;
  line: Line;
}): RegionsParseState => {
  // Ends the target's side and starts the base's.
  if (isMarkerLine(BASE_MARKER)(line.text)) {
    const base = {
      ...line,
      label: labelOf({ marker: BASE_MARKER, line: line.text }),
    };
    return { complete, open: { side: 'base', start: open.start, base } };
  }

  // Ends the target's side and starts the source's.
  if (line.text === SEPARATOR) {
    return {
      complete,
      open: { side: 'source', start: open.start, base: null, separator: line },
    };
  }

  // Ends a region without a separator, so it is not a region.
  if (isMarkerLine(END_MARKER)(line.text)) {
    return { complete, open: null };
  }

  return { complete, open };
};

const parseLineWhileInBase = ({
  complete,
  open,
  line,
}: {
  complete: MergeConflictRegion[];
  open: OpenRegionBaseState;
  line: Line;
}): RegionsParseState => {
  // Ends the base's side and starts the source's.
  if (line.text === SEPARATOR) {
    return {
      complete,
      open: {
        side: 'source',
        start: open.start,
        base: open.base,
        separator: line,
      },
    };
  }

  // Ends a region without a separator, so it is not a region.
  if (isMarkerLine(END_MARKER)(line.text)) {
    return { complete, open: null };
  }

  return { complete, open };
};

const parseLineWhileInSource = ({
  complete,
  open,
  line,
}: {
  complete: MergeConflictRegion[];
  open: OpenRegionSourceState;
  line: Line;
}): RegionsParseState => {
  // Completes the region.
  if (isMarkerLine(END_MARKER)(line.text)) {
    const end = {
      ...line,
      label: labelOf({ marker: END_MARKER, line: line.text }),
    };
    return {
      complete: [...complete, completeRegion({ open, end })],
      open: null,
    };
  }

  return { complete, open };
};

const addLineToRegions = ({
  state: { complete, open },
  line,
}: {
  state: RegionsParseState;
  line: Line;
}): RegionsParseState => {
  // Opens a region on any side, dropping any open one.
  if (isMarkerLine(START_MARKER)(line.text)) {
    const start = {
      ...line,
      label: labelOf({ marker: START_MARKER, line: line.text }),
    };
    return { complete, open: { side: 'target', start } };
  }

  // Text outside any region.
  if (open === null) {
    return { complete, open };
  }

  switch (open.side) {
    case 'target':
      return parseLineWhileInTarget({ complete, open, line });
    case 'base':
      return parseLineWhileInBase({ complete, open, line });
    case 'source':
      return parseLineWhileInSource({ complete, open, line });
  }
};

// The complete marked regions, in order. A region whose markers were partly
// edited away is not a region, and its remaining marker lines are text.
export const parseMergeConflictRegions = (
  text: string
): MergeConflictRegion[] =>
  splitLines(text).reduce<RegionsParseState>(
    (state, line) => addLineToRegions({ state, line }),
    { complete: [], open: null }
  ).complete;

const sideText = ({ text, side }: { text: string; side: MergeConflictSide }) =>
  text.slice(side.from, side.to);

// The text that replaces a region to resolve it.
export const resolveMergeConflictRegion = ({
  text,
  region,
  resolution,
}: {
  text: string;
  region: MergeConflictRegion;
  resolution: MergeConflictResolution;
}): string => {
  if (resolution === mergeConflictResolutions.MERGE_TARGET) {
    return sideText({ text, side: region.target });
  }

  if (resolution === mergeConflictResolutions.MERGE_SOURCE) {
    return sideText({ text, side: region.source });
  }

  return (
    sideText({ text, side: region.target }) +
    sideText({ text, side: region.source })
  );
};

// Whether any line still starts or ends a marked region, complete or not.
// A separator line alone is ordinary text.
export const hasMergeConflictMarkers = (text: string): boolean =>
  splitLines(text).some(
    (line) =>
      isMarkerLine(START_MARKER)(line.text) ||
      isMarkerLine(END_MARKER)(line.text)
  );
