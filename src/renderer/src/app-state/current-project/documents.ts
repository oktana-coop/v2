import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  createDocumentInProject,
  findFileNodeByPath,
  getNewDocumentName,
  listNamesInDirectory,
  parseProjectRelPath,
  type ProjectRelPath,
  urlEncodeProjectId,
  VersionedProjectValidationErrorTag,
} from '../../../../modules/domain/project';
import { FilesystemAlreadyExistsErrorTag } from '../../../../modules/infrastructure/filesystem';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { urlEncodeArtifactId } from '../../../../modules/infrastructure/version-control';
import { type PendingNewDocument, type ProjectContextType } from './types';

type DocumentDeps = Pick<
  ProjectContextType,
  'projectId' | 'projectStore' | 'directoryTree' | 'refreshDirectoryTree'
> & {
  currentArtifactPath: ProjectRelPath | null;
};

type DocumentOps = Pick<
  ProjectContextType,
  | 'pendingNewDocument'
  | 'startCreateDocument'
  | 'createDocument'
  | 'cancelCreateDocument'
  | 'createDocumentError'
  | 'clearCreateDocumentError'
  | 'filePathToDelete'
  | 'startDeleteDocument'
  | 'deleteDocument'
  | 'confirmDeleteDocument'
  | 'cancelDeleteDocument'
>;

export const useDocumentOps = ({
  projectId,
  projectStore,
  directoryTree,
  refreshDirectoryTree,
  currentArtifactPath,
}: DocumentDeps): DocumentOps => {
  const { dispatchNotification } = useContext(NotificationsContext);
  const navigate = useNavigate();

  const [filePathToDelete, setFileToDelete] = useState<string | null>(null);
  const [pendingNewDocument, setPendingNewDocument] =
    useState<PendingNewDocument | null>(null);
  const [createDocumentError, setCreateDocumentError] = useState<string | null>(
    null
  );

  const startCreateDocument = useCallback(
    (parentPath?: string) => {
      const defaultName = getNewDocumentName({
        namesInDirectory: listNamesInDirectory({
          tree: directoryTree,
          directoryPath: parentPath
            ? parseProjectRelPath(parentPath)
            : undefined,
        }),
      });

      setPendingNewDocument({ parentPath, defaultName });
      setCreateDocumentError(null);
    },
    [directoryTree]
  );

  const handleCreateDocument = useCallback(
    async (name: string) => {
      if (!projectStore || !projectId || !pendingNewDocument) return;

      const parentDirectoryPath = pendingNewDocument.parentPath
        ? parseProjectRelPath(pendingNewDocument.parentPath)
        : undefined;

      try {
        const result = await Effect.runPromise(
          pipe(
            createDocumentInProject({
              createDocument: projectStore.createDocument,
            })({ projectId, parentDirectoryPath, name }),
            Effect.map((documentId) => ({ documentId, error: null })),
            Effect.catchTags({
              [VersionedProjectValidationErrorTag]: (err) =>
                Effect.succeed({
                  documentId: null,
                  error: err.message,
                }),
              [FilesystemAlreadyExistsErrorTag]: () =>
                Effect.succeed({
                  documentId: null,
                  error: 'A document with this name already exists',
                }),
            })
          )
        );

        if (result.error !== null) {
          setCreateDocumentError(result.error);
          return;
        }

        await refreshDirectoryTree();
        setPendingNewDocument(null);
        setCreateDocumentError(null);
        navigate(
          `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(result.documentId)}`
        );
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Create Document Error',
            message:
              'An error happened when trying to create the document. Please try again.',
          })
        );
        setPendingNewDocument(null);
        setCreateDocumentError(null);
      }
    },
    [
      projectStore,
      projectId,
      pendingNewDocument,
      refreshDirectoryTree,
      navigate,
      dispatchNotification,
    ]
  );

  const cancelCreateDocument = useCallback(() => {
    setPendingNewDocument(null);
    setCreateDocumentError(null);
  }, []);

  const clearCreateDocumentError = useCallback(() => {
    setCreateDocumentError(null);
  }, []);

  const handleDeleteDocument = useCallback(
    async ({ relativePath }: { relativePath: string }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Cannot delete file. Document and project store have not been initialized yet.'
        );
      }

      const documentId = findFileNodeByPath({
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
    pendingNewDocument,
    startCreateDocument,
    createDocument: handleCreateDocument,
    cancelCreateDocument,
    createDocumentError,
    clearCreateDocumentError,
    filePathToDelete,
    startDeleteDocument: setFileToDelete,
    deleteDocument: handleDeleteDocument,
    confirmDeleteDocument: handleConfirmDeleteDocument,
    cancelDeleteDocument: handleCancelDeleteDocument,
  };
};
