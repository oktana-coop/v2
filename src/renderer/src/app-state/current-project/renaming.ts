import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  isPathInsideDirectory,
  parseProjectRelPath,
  type ProjectRelPath,
  renameDocumentInProject,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import { FilesystemAlreadyExistsErrorTag } from '../../../../modules/infrastructure/filesystem';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { urlEncodeArtifactId } from '../../../../modules/infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
import { type ProjectContextType } from './types';

type RenamingDeps = Pick<
  ProjectContextType,
  | 'projectId'
  | 'projectStore'
  | 'currentBranch'
  | 'refreshDirectoryTree'
  | 'findDocumentInProject'
> & {
  currentArtifactPath: ProjectRelPath | null;
};

type RenamingOps = Pick<
  ProjectContextType,
  | 'filePathToRename'
  | 'startRenameDocument'
  | 'renameDocumentError'
  | 'clearRenameDocumentError'
  | 'renameDocument'
  | 'cancelRenameDocument'
  | 'directoryPathToRename'
  | 'startRenameDirectory'
  | 'renameDirectoryError'
  | 'clearRenameDirectoryError'
  | 'renameDirectory'
  | 'cancelRenameDirectory'
>;

export const useRenamingOps = ({
  projectId,
  projectStore,
  currentBranch,
  refreshDirectoryTree,
  findDocumentInProject,
  currentArtifactPath,
}: RenamingDeps): RenamingOps => {
  const { filesystem } = useContext(InfrastructureAdaptersContext);
  const { dispatchNotification } = useContext(NotificationsContext);
  const navigate = useNavigate();

  const [filePathToRename, setDocumentPathToRename] = useState<string | null>(
    null
  );
  const [renameDocumentError, setRenameDocumentError] = useState<string | null>(
    null
  );
  const [directoryPathToRename, setDirectoryPathToRename] = useState<
    string | null
  >(null);
  const [renameDirectoryError, setRenameDirectoryError] = useState<
    string | null
  >(null);

  const startRenameDocument = useCallback((path: string) => {
    setDocumentPathToRename(path);
    setRenameDocumentError(null);
  }, []);

  const startRenameDirectory = useCallback((path: string) => {
    setDirectoryPathToRename(path);
    setRenameDirectoryError(null);
  }, []);

  const handleRenameDocument = useCallback(
    async ({
      oldRelativePath,
      newName,
    }: {
      oldRelativePath: string;
      newName: string;
    }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Cannot rename document. The project store has not been initialized yet.'
        );
      }

      if (!newName.trim()) {
        return;
      }

      try {
        const result = await Effect.runPromise(
          pipe(
            renameDocumentInProject({
              renameDocumentInProjectStore:
                projectStore.renameDocumentInProject,
              getRenamedPath: filesystem.getRenamedPath,
            })({
              projectId,
              oldDocumentPath: oldRelativePath,
              newName,
            }),
            Effect.map(({ newDocumentPath }) => ({
              collision: false as const,
              newDocumentPath,
            })),
            Effect.catchTag(FilesystemAlreadyExistsErrorTag, () =>
              Effect.succeed({
                collision: true as const,
                newDocumentPath: null,
              })
            )
          )
        );

        if (result.collision) {
          setRenameDocumentError('A document with this name already exists');
          return;
        }

        await refreshDirectoryTree();

        // If the open file was the one renamed, follow it to its new id.
        if (currentArtifactPath === oldRelativePath && currentBranch) {
          const newDocumentId = await Effect.runPromise(
            projectStore.lookupArtifactByPath({
              projectId,
              path: result.newDocumentPath,
              ref: currentBranch,
            })
          );
          navigate(
            `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(newDocumentId)}`
          );
        }

        setDocumentPathToRename(null);
        setRenameDocumentError(null);
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Rename Document Error',
            message:
              'An error happened when trying to rename the document. Please try again.',
          })
        );
        setDocumentPathToRename(null);
        setRenameDocumentError(null);
      }
    },
    [
      projectStore,
      projectId,
      filesystem,
      currentBranch,
      currentArtifactPath,
      navigate,
      refreshDirectoryTree,
      dispatchNotification,
    ]
  );

  const clearRenameDocumentError = useCallback(() => {
    setRenameDocumentError(null);
  }, []);

  const cancelRenameDocument = useCallback(() => {
    setDocumentPathToRename(null);
    setRenameDocumentError(null);
  }, []);

  const handleRenameDirectory = useCallback(
    async ({
      oldRelativePath,
      newName,
    }: {
      oldRelativePath: string;
      newName: string;
    }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Cannot rename directory. The project store has not been initialized yet.'
        );
      }

      if (!newName.trim()) {
        return;
      }

      try {
        const result = await Effect.runPromise(
          pipe(
            projectStore.renameDirectory({
              projectId,
              oldDirectoryPath: oldRelativePath,
              newDirectoryName: newName,
            }),
            Effect.map(({ newDirectoryPath }) => ({
              collision: false as const,
              newDirectoryPath,
            })),
            Effect.catchTag(FilesystemAlreadyExistsErrorTag, () =>
              Effect.succeed({
                collision: true as const,
                newDirectoryPath: null,
              })
            )
          )
        );

        if (result.collision) {
          setRenameDirectoryError('A folder with this name already exists');
          return;
        }

        await refreshDirectoryTree();

        // If the open file was inside the renamed directory, follow it to its
        // new path under the renamed directory.
        if (
          currentArtifactPath &&
          isPathInsideDirectory({
            directoryPath: parseProjectRelPath(oldRelativePath),
            filePath: currentArtifactPath,
          })
        ) {
          const newFilePath =
            result.newDirectoryPath +
            currentArtifactPath.slice(oldRelativePath.length);
          try {
            const doc = await findDocumentInProject({
              projectId,
              documentPath: newFilePath,
            });
            navigate(
              `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(doc.id)}`
            );
          } catch {
            navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
          }
        }

        setDirectoryPathToRename(null);
        setRenameDirectoryError(null);
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Rename Folder Error',
            message:
              'An error happened when trying to rename the folder. Please try again.',
          })
        );
        setDirectoryPathToRename(null);
        setRenameDirectoryError(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      projectStore,
      projectId,
      currentArtifactPath,
      navigate,
      refreshDirectoryTree,
      dispatchNotification,
    ]
  );

  const clearRenameDirectoryError = useCallback(() => {
    setRenameDirectoryError(null);
  }, []);

  const cancelRenameDirectory = useCallback(() => {
    setDirectoryPathToRename(null);
    setRenameDirectoryError(null);
  }, []);

  return {
    filePathToRename,
    startRenameDocument,
    renameDocumentError,
    clearRenameDocumentError,
    renameDocument: handleRenameDocument,
    cancelRenameDocument,
    directoryPathToRename,
    startRenameDirectory,
    renameDirectoryError,
    clearRenameDirectoryError,
    renameDirectory: handleRenameDirectory,
    cancelRenameDirectory,
  };
};
