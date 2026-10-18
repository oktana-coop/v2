import * as Effect from 'effect/Effect';
import { useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  isPathInsideDirectory,
  parseProjectRelPath,
  type ProjectRelPath,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { type PendingNewDirectory, type ProjectContextType } from './types';

type DirectoryDeps = Pick<
  ProjectContextType,
  'projectId' | 'projectStore' | 'refreshDirectoryTree'
> & {
  currentArtifactPath: ProjectRelPath | null;
};

type DirectoryOps = Pick<
  ProjectContextType,
  | 'pendingNewDirectory'
  | 'startCreateDirectory'
  | 'createDirectory'
  | 'cancelCreateDirectory'
  | 'directoryPathToDelete'
  | 'startDeleteDirectory'
  | 'deleteDirectory'
  | 'confirmDeleteDirectory'
  | 'cancelDeleteDirectory'
>;

export const useDirectoryOps = ({
  projectId,
  projectStore,
  refreshDirectoryTree,
  currentArtifactPath,
}: DirectoryDeps): DirectoryOps => {
  const { dispatchNotification } = useContext(NotificationsContext);
  const navigate = useNavigate();

  const [pendingNewDirectory, setPendingNewDirectory] =
    useState<PendingNewDirectory | null>(null);
  const [directoryPathToDelete, setDirectoryToDelete] = useState<string | null>(
    null
  );

  const handleCreateDirectory = useCallback(
    async (name: string) => {
      if (!projectStore || !projectId || !pendingNewDirectory) return;

      const parentDirectoryPath = pendingNewDirectory.parentPath
        ? parseProjectRelPath(pendingNewDirectory.parentPath)
        : undefined;

      await Effect.runPromise(
        projectStore.createDirectory({ projectId, parentDirectoryPath, name })
      );

      await refreshDirectoryTree();
      setPendingNewDirectory(null);
    },
    [projectStore, projectId, pendingNewDirectory, refreshDirectoryTree]
  );

  const startCreateDirectory = useCallback(
    (parentPath?: string) => setPendingNewDirectory({ parentPath }),
    []
  );

  const cancelCreateDirectory = useCallback(() => {
    setPendingNewDirectory(null);
  }, []);

  const handleDeleteDirectory = useCallback(
    async ({ relativePath }: { relativePath: string }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Cannot delete folder. Document and project store have not been initialized yet.'
        );
      }

      const directoryPath = parseProjectRelPath(relativePath);

      try {
        await Effect.runPromise(
          projectStore.deleteDirectory({ projectId, directoryPath })
        );

        await refreshDirectoryTree();

        // If the open file was inside the deleted directory, navigate away.
        if (
          currentArtifactPath &&
          isPathInsideDirectory({
            directoryPath,
            filePath: currentArtifactPath,
          })
        ) {
          navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
        }

        setDirectoryToDelete(null);
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Delete Folder Error',
            message:
              'An error happened when trying to delete the folder. Please try again.',
          })
        );
        setDirectoryToDelete(null);
      }
    },
    [
      projectStore,
      projectId,
      currentArtifactPath,
      navigate,
      refreshDirectoryTree,
      dispatchNotification,
    ]
  );

  const handleConfirmDeleteDirectory = useCallback(() => {
    if (directoryPathToDelete) {
      handleDeleteDirectory({ relativePath: directoryPathToDelete });
    }
  }, [directoryPathToDelete, handleDeleteDirectory]);

  const handleCancelDeleteDirectory = useCallback(
    () => setDirectoryToDelete(null),
    []
  );

  return {
    pendingNewDirectory,
    startCreateDirectory,
    createDirectory: handleCreateDirectory,
    cancelCreateDirectory,
    directoryPathToDelete,
    startDeleteDirectory: setDirectoryToDelete,
    deleteDirectory: handleDeleteDirectory,
    confirmDeleteDirectory: handleConfirmDeleteDirectory,
    cancelDeleteDirectory: handleCancelDeleteDirectory,
  };
};
