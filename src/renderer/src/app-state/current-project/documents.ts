import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import { useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  createDocumentInProject,
  findNodeByPath,
  parseProjectRelPath,
  type ProjectId,
  type ProjectRelPath,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { type ChangeId } from '../../../../modules/infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
import { type CreateNewDocumentArgs, type ProjectContextType } from './types';

type DocumentDeps = Pick<
  ProjectContextType,
  | 'projectId'
  | 'projectStore'
  | 'directory'
  | 'directoryTree'
  | 'refreshDirectoryTree'
> & {
  currentArtifactPath: ProjectRelPath | null;
};

type DocumentOps = Pick<
  ProjectContextType,
  | 'createNewDocument'
  | 'findDocumentInProject'
  | 'filePathToDelete'
  | 'startDeleteDocument'
  | 'deleteDocument'
  | 'confirmDeleteDocument'
  | 'cancelDeleteDocument'
>;

export const useDocumentOps = ({
  projectId,
  projectStore,
  directory,
  directoryTree,
  refreshDirectoryTree,
  currentArtifactPath,
}: DocumentDeps): DocumentOps => {
  const { filesystem } = useContext(InfrastructureAdaptersContext);
  const { dispatchNotification } = useContext(NotificationsContext);
  const navigate = useNavigate();

  const [filePathToDelete, setFileToDelete] = useState<string | null>(null);

  const handleCreateNewDocument = useCallback(
    async (args?: CreateNewDocumentArgs) => {
      if (!projectStore || !projectId || !directory) {
        throw new Error(
          'Cannot create document. Document and project store have not been initialized yet.'
        );
      }

      const parentDirectoryId = args?.parentPath
        ? (findNodeByPath({
            tree: directoryTree,
            path: parseProjectRelPath(args.parentPath),
          })?.id ?? undefined)
        : undefined;

      const result = await Effect.runPromise(
        pipe(
          createDocumentInProject({
            createNewFile: filesystem.createNewFile,
            getRelativePath: filesystem.getRelativePath,
            getAbsolutePath: filesystem.getAbsolutePath,
            getArtifactPathById: projectStore.getArtifactPathById,
            createDocument: projectStore.createDocument,
          })({
            projectId,
            projectDirectory: directory,
            parentDirectoryId,
            content: null,
          }),
          Effect.map(Option.getOrNull)
        )
      );

      // Save dialog was cancelled.
      if (!result) {
        return null;
      }

      await refreshDirectoryTree();

      return {
        projectId,
        documentId: result.documentId,
        path: result.filePath,
      };
    },
    [
      projectStore,
      projectId,
      directory,
      filesystem,
      directoryTree,
      refreshDirectoryTree,
    ]
  );

  const handleFindDocumentInProject = async (args: {
    projectId: ProjectId;
    documentPath: string;
    changeId?: ChangeId;
  }) => {
    if (!projectStore) {
      throw new Error(
        'Cannot create document. Document and project store have not been initialized yet.'
      );
    }

    return Effect.runPromise(
      projectStore.findDocumentByPath({
        projectId: args.projectId,
        documentPath: args.documentPath,
        changeId: args.changeId,
      })
    );
  };

  const handleDeleteDocument = useCallback(
    async ({ relativePath }: { relativePath: string }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Cannot delete file. Document and project store have not been initialized yet.'
        );
      }

      const documentId = findNodeByPath({
        tree: directoryTree,
        path: parseProjectRelPath(relativePath),
      })?.id;
      if (!documentId) {
        setFileToDelete(null);
        return;
      }

      try {
        await Effect.runPromise(
          projectStore.deleteDocument({
            documentId,
            projectId,
            deleteFromFilesystem: true,
          })
        );

        await refreshDirectoryTree();

        // If the open file was the one deleted, navigate away from it.
        if (currentArtifactPath === relativePath) {
          navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
        }

        setFileToDelete(null);
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Delete File Error',
            message:
              'An error happened when trying to delete the file. Please try again.',
          })
        );
        setFileToDelete(null);
      }
    },
    [
      projectStore,
      projectId,
      directoryTree,
      currentArtifactPath,
      navigate,
      refreshDirectoryTree,
      dispatchNotification,
    ]
  );

  const handleConfirmDeleteDocument = useCallback(() => {
    if (filePathToDelete) {
      handleDeleteDocument({ relativePath: filePathToDelete });
    }
  }, [filePathToDelete, handleDeleteDocument]);

  const handleCancelDeleteDocument = useCallback(
    () => setFileToDelete(null),
    []
  );

  return {
    createNewDocument: handleCreateNewDocument,
    findDocumentInProject: handleFindDocumentInProject,
    filePathToDelete,
    startDeleteDocument: setFileToDelete,
    deleteDocument: handleDeleteDocument,
    confirmDeleteDocument: handleConfirmDeleteDocument,
    cancelDeleteDocument: handleCancelDeleteDocument,
  };
};
