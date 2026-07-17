import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router';

import { urlEncodeProjectId } from '../../../../modules/domain/project';
import {
  createErrorNotification,
  createSuccessNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type ArtifactId,
  type MergeConflictInfo,
} from '../../../../modules/infrastructure/version-control';
import { useNavigateToResolveConflicts } from '../../hooks';
import { type ProjectContextType } from './types';

type MergingDeps = Pick<ProjectContextType, 'projectId' | 'projectStore'> & {
  setMergeConflictInfo: (info: MergeConflictInfo | null) => void;
};

type MergingOps = Pick<
  ProjectContextType,
  | 'abortMerge'
  | 'refreshConflictsAndMergeIfPossible'
  | 'resolveConflictByKeepingDocument'
  | 'resolveConflictByDeletingDocument'
>;

export const useMergingOps = ({
  projectId,
  projectStore,
  setMergeConflictInfo,
}: MergingDeps): MergingOps => {
  const { dispatchNotification } = useContext(NotificationsContext);
  const navigate = useNavigate();
  const navigateToResolveMergeConflicts = useNavigateToResolveConflicts();

  const handleAbortMerge = useCallback(async () => {
    if (!projectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot abort merge.'
      );
    }

    const { notification } = await Effect.runPromise(
      pipe(
        pipe(
          projectStore.abortMerge({
            projectId,
          }),
          Effect.map(() => ({
            notification: null,
          }))
        ),
        Effect.catchAll((err) => {
          console.error(err);
          const notification = createErrorNotification({
            title: 'Abort Merge Error',
            message:
              'An error happened when trying to abort the merge operation. Please contact us for support.',
          });

          return Effect.succeed({
            notification,
          });
        })
      )
    );

    if (notification) {
      dispatchNotification(notification);
    } else {
      navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStore, projectId]);

  const handleRefreshConflictsAndMergeIfPossible = useCallback(async () => {
    if (!projectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot get merge conflict info.'
      );
    }

    const { notification, conflictInfo } = await Effect.runPromise(
      pipe(
        pipe(
          projectStore.getMergeConflictInfo({
            projectId,
          }),
          Effect.tap((conflictInfo) => {
            const conflicts = conflictInfo?.conflicts;

            return conflicts && conflicts.length > 0
              ? Effect.succeed(undefined)
              : projectStore.commitMergeConflictsResolution({
                  projectId,
                });
          }),
          Effect.map((conflictInfo) => ({
            conflictInfo,
            notification: null,
          }))
        ),
        Effect.catchAll((err) => {
          console.error(err);
          const notification = createErrorNotification({
            title: 'Get Merge Conflict Info Error',
            message:
              'An error happened when trying to get the merge conflict info. Please refresh and, if the problem is not resolved, contact us for support.',
          });

          return Effect.succeed({
            conflictInfo: null,
            notification,
          });
        })
      )
    );

    if (notification) {
      dispatchNotification(notification);
    } else {
      if (conflictInfo && conflictInfo.conflicts.length > 0) {
        setMergeConflictInfo(conflictInfo);
        navigateToResolveMergeConflicts({
          projectId,
          mergeConflictInfo: conflictInfo,
        });
      } else {
        const notification = createSuccessNotification({
          title: 'Successful Merge',
          message:
            'The branch was merged successfully. You are back in the main branch.',
        });
        dispatchNotification(notification);
        setMergeConflictInfo(null);
        navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStore, projectId, navigateToResolveMergeConflicts]);

  const handleResolveConflictByKeepingDocument = useCallback(
    async (documentId: ArtifactId) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot resolve the conflict.'
        );
      }

      try {
        await Effect.runPromise(
          projectStore.resolveConflictByKeepingDocument({
            projectId,
            documentId,
          })
        );
      } catch (err) {
        console.error(err);

        const notification = createErrorNotification({
          title: 'Resolve Conflict Error',
          message: `An error happened when trying to resolve the conflict. Please try again and if the error persists contact us for support.`,
        });
        dispatchNotification(notification);
      }

      handleRefreshConflictsAndMergeIfPossible();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectStore, projectId, handleRefreshConflictsAndMergeIfPossible]
  );

  const handleResolveConflictByDeletingDocument = useCallback(
    async (documentId: ArtifactId) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot resolve the conflict.'
        );
      }

      try {
        await Effect.runPromise(
          projectStore.resolveConflictByDeletingDocument({
            projectId,
            documentId,
          })
        );
      } catch (err) {
        console.error(err);

        const notification = createErrorNotification({
          title: 'Resolve Conflict Error',
          message: `An error happened when trying to resolve the conflict. Please try again and if the error persists contact us for support.`,
        });
        dispatchNotification(notification);
      }

      handleRefreshConflictsAndMergeIfPossible();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectStore, projectId, handleRefreshConflictsAndMergeIfPossible]
  );

  return {
    abortMerge: handleAbortMerge,
    refreshConflictsAndMergeIfPossible:
      handleRefreshConflictsAndMergeIfPossible,
    resolveConflictByKeepingDocument: handleResolveConflictByKeepingDocument,
    resolveConflictByDeletingDocument: handleResolveConflictByDeletingDocument,
  };
};
