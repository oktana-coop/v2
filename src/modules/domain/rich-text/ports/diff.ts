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
  // Optional hook used by the delete-widget renderer. Deleted nodes are
  // serialized via the schema's `toDOM` (not via NodeViews), so any
  // src transforms that NodeViews would normally do — e.g. resolving
  // `assets/foo.jpg` to a `project-asset://` URL — have to be applied
  // here instead.
  transformImageSrc?: (src: string) => string;
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
