import { type Node, type Schema } from 'prosemirror-model';
import { type Step } from 'prosemirror-transform';
import { type DecorationSet } from 'prosemirror-view';

import { type RichTextDocument, type RichTextRepresentation } from '../models';

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

export type ProseMirrorStepsArgs = {
  pmDocBefore: Node;
  docAfter: RichTextDocument;
  proseMirrorSchema: Schema;
};

export type ProseMirrorStepsResult = {
  pmDocAfter: Node;
  steps: Step[];
};

export type DiffPatch = {
  proseMirrorDiff: (
    args: ProseMirrorDiffArgs
  ) => Promise<ProseMirrorDiffResult>;
  proseMirrorSteps: (
    args: ProseMirrorStepsArgs
  ) => Promise<ProseMirrorStepsResult>;
};
