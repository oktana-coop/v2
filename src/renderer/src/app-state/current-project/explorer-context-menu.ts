import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { urlEncodeProjectId } from '../../../../modules/domain/project';
import {
  EXPLORER_TREE_DIRECTORY,
  EXPLORER_TREE_FILE,
} from '../../../../modules/infrastructure/cross-platform';
import { urlEncodeArtifactId } from '../../../../modules/infrastructure/version-control';
import { type ProjectContextType } from './types';

type ExplorerContextMenuDeps = Pick<
  ProjectContextType,
  | 'createNewDocument'
  | 'startCreateDirectory'
  | 'startDeleteDocument'
  | 'startDeleteDirectory'
  | 'startRenameDocument'
  | 'startRenameDirectory'
>;

// Translates native explorer context-menu actions into the ops that back them.
export const useExplorerContextMenu = ({
  createNewDocument,
  startCreateDirectory,
  startDeleteDocument,
  startDeleteDirectory,
  startRenameDocument,
  startRenameDirectory,
}: ExplorerContextMenuDeps): void => {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = window.electronAPI.onContextMenuAction(
      async (action) => {
        if (
          action.context === EXPLORER_TREE_DIRECTORY &&
          action.action.type === 'NEW_FILE'
        ) {
          const result = await createNewDocument({
            parentPath: action.action.parentPath,
          });

          if (!result) return;

          const { documentId, projectId: projId } = result;

          navigate(
            `/projects/${urlEncodeProjectId(projId)}/artifacts/${urlEncodeArtifactId(documentId)}`
          );
        }

        if (
          action.context === EXPLORER_TREE_DIRECTORY &&
          action.action.type === 'NEW_DIRECTORY'
        ) {
          startCreateDirectory(action.action.parentPath);
        }

        if (
          action.context === EXPLORER_TREE_FILE &&
          action.action.type === 'DELETE'
        ) {
          startDeleteDocument(action.action.path);
        }

        if (
          action.context === EXPLORER_TREE_DIRECTORY &&
          action.action.type === 'DELETE'
        ) {
          startDeleteDirectory(action.action.path);
        }

        if (
          action.context === EXPLORER_TREE_FILE &&
          action.action.type === 'RENAME'
        ) {
          startRenameDocument(action.action.path);
        }

        if (
          action.context === EXPLORER_TREE_DIRECTORY &&
          action.action.type === 'RENAME'
        ) {
          startRenameDirectory(action.action.path);
        }
      }
    );

    return unsubscribe;
  }, [
    createNewDocument,
    startCreateDirectory,
    startDeleteDocument,
    startDeleteDirectory,
    startRenameDocument,
    startRenameDirectory,
    navigate,
  ]);
};
