import * as Effect from 'effect/Effect';

import {
  RepresentationTransformError,
  ResolveMergeConflictsError,
} from '../errors';
import { RichTextDocument } from '../models';

export type ResolveMergeConflictsArgs = {
  sourceDocument: RichTextDocument;
  targetDocument: RichTextDocument;
  commonAncestorDocument: RichTextDocument;
};

export type ResolveMergeConflictsResult = {
  mergedDocument: RichTextDocument;
};

export type MergeConflictResolver = {
  resolveMergeConflicts: (
    args: ResolveMergeConflictsArgs
  ) => Effect.Effect<
    ResolveMergeConflictsResult,
    RepresentationTransformError | ResolveMergeConflictsError,
    never
  >;
};
