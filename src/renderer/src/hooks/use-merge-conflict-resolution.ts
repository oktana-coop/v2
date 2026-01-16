import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useEffect, useState } from 'react';

import { type ProjectId, projectTypes } from '../../../modules/domain/project';
import {
  processDocumentChange,
  type RichTextDocument,
  suggestMerge,
} from '../../../modules/domain/rich-text';
import { MergeConflictResolverContext } from '../../../modules/domain/rich-text/react/merge-conflict-resover-context';
import { RepresentationTransformContext } from '../../../modules/domain/rich-text/react/representation-transform-context';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../modules/infrastructure/notifications/browser';
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

const buildCommitMessage = (mergeConflictInfo: MergeConflictInfo) =>
  `Merge branch${mergeConflictInfo.sourceBranch ? ` ${mergeConflictInfo.sourceBranch}` : ''}`;

export const useMergeConflictResolution = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const {
    mergeConflictInfo: multiDocumentProjectMergeConflictInfo,
    abortMerge: abortMergeInMultiDocumentProject,
    refreshConflictsAndMergeIfPossible:
      refreshConflictsAndMergeIfPossibleInMultiDocProject,
    directory,
    resolveConflictByKeepingDocument,
    resolveConflictByDeletingDocument,
  } = useContext(MultiDocumentProjectContext);
  const {
    mergeConflictInfo: singleDocumentProjectMergeConflictInfo,
    abortMerge: abortMergeInSingleDocumentProject,
    refreshConflictsAndMergeIfPossible:
      refreshConflictsAndMergeIfPossibleInSingleDocProject,
    documentInternalPath,
  } = useContext(SingleDocumentProjectContext);
  const { versionedDocumentStore, filesystem } = useContext(
    InfrastructureAdaptersContext
  );
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const { adapter: mergeConflictResolver } = useContext(
    MergeConflictResolverContext
  );
  const { dispatchNotification } = useContext(NotificationsContext);

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

  const refreshConflictsAndMergeIfPossible = useCallback(
    () =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? refreshConflictsAndMergeIfPossibleInMultiDocProject()
        : refreshConflictsAndMergeIfPossibleInSingleDocProject(),
    [
      projectType,
      refreshConflictsAndMergeIfPossibleInMultiDocProject,
      refreshConflictsAndMergeIfPossibleInSingleDocProject,
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

  const resolveContentConflict = useCallback(
    async ({
      documentId,
      relativePath,
      projectId,
      doc,
    }: {
      documentId: ResolvedArtifactId;
      relativePath: string;
      projectId: ProjectId;
      doc: RichTextDocument;
    }) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      if (!representationTransformAdapter) {
        throw new Error(
          'No representation transform adapter found when trying to resolve a content conflict.'
        );
      }

      if (!mergeConflictInfo) {
        throw new Error(
          'No merge conflict info found when trying to resolve a conflict.'
        );
      }

      if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
        if (!directory || !relativePath) {
          throw new Error('Cannot update file in multi-doc project');
        }

        try {
          await Effect.runPromise(
            pipe(
              filesystem.getAbsolutePath({
                path: relativePath,
                dirPath: directory.path,
              }),
              Effect.flatMap((absoluteFilePath) =>
                processDocumentChange({
                  transformToText:
                    representationTransformAdapter.transformToText,
                  updateRichTextDocumentContent:
                    versionedDocumentStore.updateRichTextDocumentContent,
                  writeFile: filesystem.writeFile,
                })({
                  documentId,
                  updatedDocument: doc,
                  writeToFileWithPath:
                    versionedDocumentStore.managesFilesystemWorkdir
                      ? absoluteFilePath
                      : null,
                  projectType,
                })
              ),
              Effect.flatMap(() =>
                versionedDocumentStore.resolveContentConflict({ documentId })
              )
            )
          );
        } catch (err) {
          console.error(err);
          const notification = createErrorNotification({
            title: 'Resolve Conflict Error',
            message:
              'An error happened when trying to resolve the conflict. Please try again and if the error persists contact us for support.',
          });

          dispatchNotification(notification);
        }
      } else {
        try {
          await Effect.runPromise(
            pipe(
              processDocumentChange({
                transformToText: representationTransformAdapter.transformToText,
                updateRichTextDocumentContent:
                  versionedDocumentStore.updateRichTextDocumentContent,
                writeFile: filesystem.writeFile,
              })({
                documentId,
                updatedDocument: doc,
                writeToFileWithPath:
                  versionedDocumentStore.managesFilesystemWorkdir
                    ? documentInternalPath
                    : null,
                projectType,
              }),
              Effect.flatMap(() =>
                versionedDocumentStore.commitChanges({
                  documentId,
                  message: buildCommitMessage(mergeConflictInfo),
                })
              )
            )
          );
        } catch (err) {
          console.error(err);
          const notification = createErrorNotification({
            title: 'Resolve Conflict Error',
            message:
              'An error happened when trying to resolve the conflict. Please try again and if the error persists contact us for support.',
          });

          dispatchNotification(notification);
        }
      }

      refreshConflictsAndMergeIfPossible();
    },
    [
      versionedDocumentStore,
      representationTransformAdapter,
      filesystem,
      directory,
      projectType,
      documentInternalPath,
      mergeConflictInfo,
      refreshConflictsAndMergeIfPossible,
      dispatchNotification,
    ]
  );

  return {
    mergeConflictInfo,
    structuralConflicts,
    compareContentConflicts,
    abortMerge,
    suggestContentMerge,
    resolveContentConflict,
    resolveConflictByKeepingDocument,
    resolveConflictByDeletingDocument,
  };
};
