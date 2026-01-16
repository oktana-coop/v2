import * as Effect from 'effect/Effect';
import { useCallback, useContext, useEffect, useState } from 'react';

import { type ProjectId, projectTypes } from '../../../modules/domain/project';
import { suggestMerge } from '../../../modules/domain/rich-text';
import { MergeConflictResolverContext } from '../../../modules/domain/rich-text/react/merge-conflict-resover-context';
import {
  type CompareContentConflict,
  isCompareContentConflict,
  isStructuralConflict,
  type MergeConflictInfo,
  type ResolvedArtifactId,
  type StructuralConflict,
} from '../../../modules/infrastructure/version-control';
import {
  CurrentProjectContext,
  InfrastructureAdaptersContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useMergeConflictResolution = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const {
    mergeConflictInfo: multiDocumentProjectMergeConflictInfo,
    abortMerge: abortMergeInMultiDocumentProject,
  } = useContext(MultiDocumentProjectContext);

  const {
    mergeConflictInfo: singleDocumentProjectMergeConflictInfo,
    abortMerge: abortMergeInSingleDocumentProject,
  } = useContext(SingleDocumentProjectContext);
  const { versionedDocumentStore } = useContext(InfrastructureAdaptersContext);
  const { adapter: mergeConflictResolver } = useContext(
    MergeConflictResolverContext
  );

  const [mergeConflictInfo, setMergeConflictInfo] =
    useState<MergeConflictInfo | null>(null);
  const [structuralConflicts, setStructuralConflicts] = useState<
    StructuralConflict[]
  >([]);
  const [compareContentConflicts, setCompareContentConflicts] = useState<
    CompareContentConflict[]
  >([]);

  useEffect(() => {
    const conflictInfo =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? multiDocumentProjectMergeConflictInfo
        : singleDocumentProjectMergeConflictInfo;

    if (conflictInfo) {
      const structuralConflicts = conflictInfo.conflicts.filter((conflict) =>
        isStructuralConflict(conflict)
      );
      const compareContentConflicts = conflictInfo.conflicts.filter(
        (conflict) => isCompareContentConflict(conflict)
      );
      setStructuralConflicts(structuralConflicts);
      setCompareContentConflicts(compareContentConflicts);
    } else {
      setStructuralConflicts([]);
      setCompareContentConflicts([]);
    }

    setMergeConflictInfo(conflictInfo);
  }, [
    multiDocumentProjectMergeConflictInfo,
    singleDocumentProjectMergeConflictInfo,
    projectType,
  ]);

  const abortMerge = useCallback(
    () =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? abortMergeInMultiDocumentProject()
        : abortMergeInSingleDocumentProject(),
    [
      projectType,
      abortMergeInMultiDocumentProject,
      abortMergeInSingleDocumentProject,
    ]
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

  return {
    mergeConflictInfo,
    structuralConflicts,
    compareContentConflicts,
    abortMerge,
    suggestContentMerge,
  };
};
