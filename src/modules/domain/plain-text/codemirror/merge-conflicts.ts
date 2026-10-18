import {
  type EditorState,
  type Extension,
  type Line,
  type Range,
  StateField,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';

import {
  type MergeConflictRegion,
  type MergeConflictResolution,
  mergeConflictResolutions,
  type MergeConflictSide,
  parseMergeConflictRegions,
  resolveMergeConflictRegion,
} from '../../../infrastructure/version-control';

const isWithin = ({
  pos,
  side,
}: {
  pos: number;
  side: MergeConflictSide | null;
}) => side !== null && pos >= side.from && pos < side.to;

const lineClass = ({
  region,
  pos,
}: {
  region: MergeConflictRegion;
  pos: number;
}) => {
  if (isWithin({ pos, side: region.target })) {
    return 'cm-mergeConflictTarget';
  }

  if (isWithin({ pos, side: region.base })) {
    return 'cm-mergeConflictBase';
  }

  if (isWithin({ pos, side: region.source })) {
    return 'cm-mergeConflictSource';
  }

  return 'cm-mergeConflictMarker';
};

type TextChange = { from: number; to: number; insert: string };

// The change that replaces the marked region at a position with the side or
// sides to keep, if a region is there.
const resolutionChange = ({
  text,
  pos,
  resolution,
}: {
  text: string;
  pos: number;
  resolution: MergeConflictResolution;
}): TextChange | null => {
  const region = parseMergeConflictRegions(text).find(
    ({ from, to }) => pos >= from && pos < to
  );

  if (!region) {
    return null;
  }

  return {
    from: region.from,
    to: region.to,
    insert: resolveMergeConflictRegion({ text, region, resolution }),
  };
};

// Replaces the marked region at a position with the side or sides to keep.
export const resolveMergeConflictAt = ({
  view,
  pos,
  resolution,
}: {
  view: EditorView;
  pos: number;
  resolution: MergeConflictResolution;
}): boolean => {
  const change = resolutionChange({
    text: view.state.doc.toString(),
    pos,
    resolution,
  });

  if (!change) {
    return false;
  }

  view.dispatch({ changes: change, userEvent: 'input' });
  return true;
};

const resolutionButton = ({
  view,
  text,
  resolution,
}: {
  view: EditorView;
  text: string;
  resolution: MergeConflictResolution;
}): HTMLButtonElement => {
  const button = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'cm-mergeConflictAction',
    textContent: text,
  });
  button.addEventListener('click', () => {
    resolveMergeConflictAt({ view, pos: view.posAtDOM(button), resolution });
  });
  return button;
};

class ResolutionActions extends WidgetType {
  readonly targetLabel: string;
  readonly sourceLabel: string;

  constructor({
    targetLabel,
    sourceLabel,
  }: {
    targetLabel: string;
    sourceLabel: string;
  }) {
    super();
    this.targetLabel = targetLabel;
    this.sourceLabel = sourceLabel;
  }

  eq(other: ResolutionActions) {
    return (
      other.targetLabel === this.targetLabel &&
      other.sourceLabel === this.sourceLabel
    );
  }

  toDOM(view: EditorView) {
    const actions = Object.assign(document.createElement('div'), {
      className: 'cm-mergeConflictActions',
    });
    actions.append(
      resolutionButton({
        view,
        text: `Keep ${this.targetLabel || 'target'}`,
        resolution: mergeConflictResolutions.MERGE_TARGET,
      }),
      resolutionButton({
        view,
        text: `Keep ${this.sourceLabel || 'source'}`,
        resolution: mergeConflictResolutions.MERGE_SOURCE,
      }),
      resolutionButton({
        view,
        text: 'Keep both',
        resolution: mergeConflictResolutions.BOTH,
      })
    );
    return actions;
  }
}

// The document lines a region spans, its marker lines included.
const regionLines = ({
  state,
  region,
}: {
  state: EditorState;
  region: MergeConflictRegion;
}): Line[] => {
  const first = state.doc.lineAt(region.from).number;
  const last = state.doc.lineAt(region.to - 1).number;

  return Array.from({ length: last - first + 1 }, (_, index) =>
    state.doc.line(first + index)
  );
};

const regionDecorations = ({
  state,
  region,
}: {
  state: EditorState;
  region: MergeConflictRegion;
}): Range<Decoration>[] => [
  Decoration.widget({
    widget: new ResolutionActions({
      targetLabel: region.target.label,
      sourceLabel: region.source.label,
    }),
    block: true,
    side: -1,
  }).range(region.from),
  ...regionLines({ state, region }).map((line) =>
    Decoration.line({ class: lineClass({ region, pos: line.from }) }).range(
      line.from
    )
  ),
];

const mergeConflictDecorations = (state: EditorState): DecorationSet =>
  Decoration.set(
    parseMergeConflictRegions(state.doc.toString()).flatMap((region) =>
      regionDecorations({ state, region })
    ),
    true
  );

// Shows the regions a merge marked as conflicting, each side in its own
// color, with actions above each region to keep either side or both.
export const mergeConflicts: Extension = StateField.define<DecorationSet>({
  create: mergeConflictDecorations,
  update: (decorations, transaction) =>
    transaction.docChanged
      ? mergeConflictDecorations(transaction.state)
      : decorations,
  provide: (field) => EditorView.decorations.from(field),
});
