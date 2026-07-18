import * as Effect from 'effect/Effect';
import { useCallback, useContext } from 'react';

import { removePath } from '../../../../modules/infrastructure/filesystem';
import {
  createInfoNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type ArtifactId,
  type Commit,
} from '../../../../modules/infrastructure/version-control';
import { type ProjectContextType } from './types';

const formatSkippedAssetNames = (skippedAssetPaths: string[]): string =>
  skippedAssetPaths.map(removePath).join(', ');

const buildSkippedAssetsOnCommitNotification = (
  skippedAssetPaths: string[]
) => {
  const isSingular = skippedAssetPaths.length === 1;

  return createInfoNotification({
    title: 'Some images were not saved',
    message: `${skippedAssetPaths.length} referenced ${
      isSingular ? 'file is' : 'files are'
    } missing from disk and ${
      isSingular ? 'was' : 'were'
    } left out of this commit: ${formatSkippedAssetNames(skippedAssetPaths)}`.slice(
      0,
      255
    ),
  });
};

const buildSkippedAssetsOnRestoreNotification = (
  skippedAssetPaths: string[]
) => {
  const isSingular = skippedAssetPaths.length === 1;

  return createInfoNotification({
    title: 'Some images were not restored',
    message: `${skippedAssetPaths.length} referenced ${
      isSingular ? 'file' : 'files'
    } could not be read from this version and ${
      isSingular ? 'was' : 'were'
    } left out: ${formatSkippedAssetNames(skippedAssetPaths)}`.slice(0, 255),
  });
};

type CommittingDeps = Pick<ProjectContextType, 'projectId' | 'projectStore'>;

type CommittingOps = Pick<
  ProjectContextType,
  'commitChanges' | 'commitDocumentChanges' | 'restoreDocumentChanges'
>;

export const useCommittingOps = ({
  projectId,
  projectStore,
}: CommittingDeps): CommittingOps => {
  const { dispatchNotification } = useContext(NotificationsContext);

  const commitChanges = useCallback(
    async (message: string) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot commit changes.'
        );
      }
      await Effect.runPromise(
        projectStore.commitChanges({ projectId, message })
      );
    },
    [projectStore, projectId]
  );

  const commitDocumentChanges = useCallback(
    async ({
      documentId,
      message,
    }: {
      documentId: ArtifactId;
      message: string;
    }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot commit changes.'
        );
      }
      const { skippedAssetPaths } = await Effect.runPromise(
        projectStore.commitDocumentChanges({
          projectId,
          documentId,
          message,
        })
      );

      if (skippedAssetPaths.length > 0) {
        dispatchNotification(
          buildSkippedAssetsOnCommitNotification(skippedAssetPaths)
        );
      }
    },
    [projectStore, projectId, dispatchNotification]
  );

  const restoreDocumentChanges = useCallback(
    async ({
      documentId,
      commit,
      message,
    }: {
      documentId: ArtifactId;
      commit: Commit;
      message?: string;
    }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot restore document.'
        );
      }
      const { commitId, skippedAssetPaths } = await Effect.runPromise(
        projectStore.restoreDocumentChanges({
          projectId,
          documentId,
          commit,
          message,
        })
      );

      if (skippedAssetPaths.length > 0) {
        dispatchNotification(
          buildSkippedAssetsOnRestoreNotification(skippedAssetPaths)
        );
      }

      return commitId;
    },
    [projectStore, projectId, dispatchNotification]
  );

  return { commitChanges, commitDocumentChanges, restoreDocumentChanges };
};
