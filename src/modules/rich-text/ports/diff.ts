import { type Node, type Schema } from 'prosemirror-model';
import { type DecorationSet } from 'prosemirror-view';

import { type RichTextRepresentation } from '../constants/representations';
import { type DiffDecorationClasses } from '../prosemirror';

export type ProseMirrorDiffArgs = {
  representation: RichTextRepresentation;
  proseMirrorSchema: Schema;
  decorationClasses: DiffDecorationClasses;
  docBefore: string;
  docAfter: string;
};

export type ProseMirrorDiffResult = {
  pmDocAfter: Node;
  decorations: DecorationSet;
};

export type Diff = {
  proseMirrorDiff: (
    args: ProseMirrorDiffArgs
  ) => Promise<ProseMirrorDiffResult>;
};
