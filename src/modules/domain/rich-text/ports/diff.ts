import { type Node, type Schema } from 'prosemirror-model';
import { type DecorationSet } from 'prosemirror-view';

import { type RichTextRepresentation } from '../models';

export type ProseMirrorDiffArgs = {
  representation: RichTextRepresentation;
  proseMirrorSchema: Schema;
  docBefore: string;
  docAfter: string;
  // Required to transform/normalize asset src URLs.
  transformImageSrc: (src: string) => string;
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
