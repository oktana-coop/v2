import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type Change,
  CommitId,
  type ResolvedArtifactId,
} from '../../../infrastructure/version-control';
import {
  RepresentationTransformError,
  ResolveMergeConflictsError,
} from '../errors';
import { RichTextDocument, type VersionedDocument } from '../models';
import { type MergeConflictResolver } from '../ports';

export type SuggestMergeArgs = {
  sourceDocumentId: ResolvedArtifactId;
  targetDocumentId: ResolvedArtifactId;
  commonAncestorDocumentId: ResolvedArtifactId;
  sourceCommitId: CommitId;
  targetCommitId: CommitId;
  commonAncestorCommitId: CommitId;
};

type GetDocumentAtChange<E> = (args: {
  documentId: ResolvedArtifactId;
  changeId: Change['id'];
}) => Effect.Effect<VersionedDocument, E, never>;

export type SuggestMergeDeps<E> = {
  getDocumentAtChange: GetDocumentAtChange<E>;
  resolveMergeConflicts: MergeConflictResolver['resolveMergeConflicts'];
};

export type SuggestMergeResult = {
  sourceDocument: RichTextDocument;
  targetDocument: RichTextDocument;
  commonAncestorDocument: RichTextDocument;
  mergedDocument: RichTextDocument;
};

export const suggestMerge =
  <E>({ getDocumentAtChange, resolveMergeConflicts }: SuggestMergeDeps<E>) =>
  ({
    sourceDocumentId,
    targetDocumentId,
    commonAncestorDocumentId,
    sourceCommitId,
    targetCommitId,
    commonAncestorCommitId,
  }: SuggestMergeArgs): Effect.Effect<
    SuggestMergeResult,
    E | RepresentationTransformError | ResolveMergeConflictsError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('sourceDocument', () =>
        getDocumentAtChange({
          documentId: sourceDocumentId,
          changeId: sourceCommitId,
        })
      ),
      Effect.bind('targetDocument', () =>
        getDocumentAtChange({
          documentId: targetDocumentId,
          changeId: targetCommitId,
        })
      ),
      Effect.bind('commonAncestorDocument', () =>
        getDocumentAtChange({
          documentId: commonAncestorDocumentId,
          changeId: commonAncestorCommitId,
        })
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
