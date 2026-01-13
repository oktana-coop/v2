import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  CommitId,
  MigrationError,
  type ResolvedArtifactId,
} from '../../../infrastructure/version-control';
import {
  NotFoundError,
  RepositoryError,
  RepresentationTransformError,
  ResolveMergeConflictsError,
  ValidationError,
} from '../errors';
import { RichTextDocument } from '../models';
import {
  type MergeConflictResolver,
  type VersionedDocumentStore,
} from '../ports';

export type SuggestMergeArgs = {
  documentId: ResolvedArtifactId;
  sourceCommitId: CommitId;
  targetCommitId: CommitId;
  commonAncestorCommitId: CommitId;
};

export type SuggestMergeDeps = {
  getDocumentAtChange: VersionedDocumentStore['getDocumentAtChange'];
  resolveMergeConflicts: MergeConflictResolver['resolveMergeConflicts'];
};

export type SuggestMergeResult = {
  sourceDocument: RichTextDocument;
  targetDocument: RichTextDocument;
  commonAncestorDocument: RichTextDocument;
  mergedDocument: RichTextDocument;
};

export const suggestMerge =
  ({ getDocumentAtChange, resolveMergeConflicts }: SuggestMergeDeps) =>
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
        'mergedDocument',
        ({ sourceDocument, targetDocument, commonAncestorDocument }) =>
          pipe(
            resolveMergeConflicts({
              sourceDocument,
              targetDocument,
              commonAncestorDocument,
            }),
            Effect.map((result) => result.mergedDocument)
          )
      )
    );
