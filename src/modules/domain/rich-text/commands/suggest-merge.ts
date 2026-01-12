import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type Node as PMNode, Schema as PMSchema } from 'prosemirror-model';
import { type DecorationSet as PMDecorationSet } from 'prosemirror-view';

import { mapErrorTo } from '../../../../utils/errors';
import {
  CommitId,
  MigrationError,
  type ResolvedArtifactId,
} from '../../../infrastructure/version-control';
import {
  DiffError,
  NotFoundError,
  RepositoryError,
  RepresentationTransformError,
  ResolveMergeConflictsError,
  ValidationError,
} from '../errors';
import {
  type Diff,
  type MergeConflictResolver,
  type VersionedDocumentStore,
} from '../ports';
import { type DiffDecorationClasses } from '../prosemirror';

export type SuggestMergeArgs = {
  documentId: ResolvedArtifactId;
  sourceCommitId: CommitId;
  targetCommitId: CommitId;
  commonAncestorCommitId: CommitId;
};

export type SuggestMergeDeps = {
  getDocumentAtChange: VersionedDocumentStore['getDocumentAtChange'];
  resolveMergeConflicts: MergeConflictResolver['resolveMergeConflicts'];
  proseMirrorDiff: Diff['proseMirrorDiff'];
  proseMirrorSchema: PMSchema;
  proseMirrorDecorationClasses: DiffDecorationClasses;
};

export type SuggestMergeResult = {
  pmDocAfter: PMNode;
  pmDecorations: PMDecorationSet;
};

export const suggestMerge =
  ({
    getDocumentAtChange,
    resolveMergeConflicts,
    proseMirrorDiff,
    proseMirrorSchema,
    proseMirrorDecorationClasses,
  }: SuggestMergeDeps) =>
  ({
    documentId,
    sourceCommitId,
    targetCommitId,
    commonAncestorCommitId,
  }: SuggestMergeArgs): Effect.Effect<
    SuggestMergeResult,
    | RepresentationTransformError
    | RepositoryError
    | NotFoundError
    | MigrationError
    | ValidationError
    | DiffError
    | ResolveMergeConflictsError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('sourceDocument', () =>
        getDocumentAtChange({ documentId, changeId: sourceCommitId })
      ),
      Effect.bind('targetDocument', () =>
        getDocumentAtChange({ documentId, changeId: targetCommitId })
      ),
      Effect.bind('commonAncestorDocument', () =>
        getDocumentAtChange({ documentId, changeId: commonAncestorCommitId })
      ),
      Effect.bind(
        'resolveMergeConflictsResult',
        ({ sourceDocument, targetDocument, commonAncestorDocument }) =>
          resolveMergeConflicts({
            sourceDocument,
            targetDocument,
            commonAncestorDocument,
          })
      ),
      Effect.flatMap(({ targetDocument, resolveMergeConflictsResult }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              proseMirrorDiff({
                representation:
                  resolveMergeConflictsResult.mergedDocument.representation,
                proseMirrorSchema,
                decorationClasses: proseMirrorDecorationClasses,
                docBefore: targetDocument.content,
                docAfter: resolveMergeConflictsResult.mergedDocument.content,
              }),
            catch: mapErrorTo(
              DiffError,
              'Error in diffing merged document with target document.'
            ),
          }),
          Effect.map(({ pmDocAfter, decorations }) => ({
            pmDocAfter,
            pmDecorations: decorations,
          }))
        )
      )
    );
