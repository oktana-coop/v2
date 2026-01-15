import * as Effect from 'effect/Effect';
import { useCallback, useContext } from 'react';

import { type ProjectId } from '../../../modules/domain/project';
import { suggestMerge } from '../../../modules/domain/rich-text';
import { MergeConflictResolverContext } from '../../../modules/domain/rich-text/react/merge-conflict-resover-context';
import {
  type MergeConflictInfo,
  type ResolvedArtifactId,
} from '../../../modules/infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../app-state';

export const useSuggestContentMerge = () => {
  const { versionedDocumentStore } = useContext(InfrastructureAdaptersContext);
  const { adapter: mergeConflictResolver } = useContext(
    MergeConflictResolverContext
  );

  const suggestContentMerge = useCallback(
    async ({
      projectId,
      sourceDocumentId,
      targetDocumentId,
      commonAncestorDocumentId,
      mergeConflictInfo,
    }: {
      projectId: ProjectId;
      sourceDocumentId: ResolvedArtifactId;
      targetDocumentId: ResolvedArtifactId;
      commonAncestorDocumentId: ResolvedArtifactId;
      mergeConflictInfo: MergeConflictInfo;
    }) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      if (!mergeConflictResolver) {
        throw new Error('Merge conflict resolver adpater not ready yet.');
      }

      return Effect.runPromise(
        suggestMerge({
          getDocumentAtChange: versionedDocumentStore.getDocumentAtChange,
          resolveMergeConflicts: mergeConflictResolver.resolveMergeConflicts,
        })({
          sourceDocumentId: sourceDocumentId,
          targetDocumentId: targetDocumentId,
          commonAncestorDocumentId: commonAncestorDocumentId,
          sourceCommitId: mergeConflictInfo.sourceCommitId,
          targetCommitId: mergeConflictInfo.targetCommitId,
          commonAncestorCommitId: mergeConflictInfo.commonAncestorCommitId,
        })
      );
    },
    [versionedDocumentStore, mergeConflictResolver]
  );

  return { suggestContentMerge };
};
