import { useEffect } from 'react';

import {
  EXPLORER_TREE_DIRECTORY,
  EXPLORER_TREE_FILE,
} from '../../../../modules/infrastructure/cross-platform';
import { type ProjectContextType } from './types';

type ExplorerContextMenuDeps = Pick<
  ProjectContextType,
  | 'startCreateDocument'
  | 'startCreateDirectory'
  | 'startDeleteDocument'
  | 'startDeleteDirectory'
  | 'startRenameDocument'
  | 'startRenameDirectory'
>;

// Translates native explorer context-menu actions into the ops that back them.
export const useExplorerContextMenu = ({
  startCreateDocument,
  startCreateDirectory,
  startDeleteDocument,
  startDeleteDirectory,
  startRenameDocument,
  startRenameDirectory,
}: ExplorerContextMenuDeps): void => {
  useEffect(() => {
    const unsubscribe = window.electronAPI.onContextMenuAction((action) => {
      if (
        action.context === EXPLORER_TREE_DIRECTORY &&
        action.action.type === 'NEW_FILE'
      ) {
        startCreateDocument(action.action.parentPath);
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
    });

    return unsubscribe;
  }, [
    startCreateDocument,
    startCreateDirectory,
    startDeleteDocument,
    startDeleteDirectory,
    startRenameDocument,
    startRenameDirectory,
  ]);
};
