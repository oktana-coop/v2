import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../app-state';

export const useDeleteDirectory = () => {
  const { directoryPathToDelete, deleteDirectory, cancelDeleteDirectory } =
    useContext(MultiDocumentProjectContext);

  const confirmDeleteDirectory = () => {
    if (directoryPathToDelete) {
      deleteDirectory({ relativePath: directoryPathToDelete });
    }
  };

  return {
    directoryPathToDelete,
    confirmDeleteDirectory,
    cancelDeleteDirectory,
  };
};
