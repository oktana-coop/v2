import { useContext } from 'react';

import { ProjectContext } from '../app-state';

export const useDeleteDirectory = () => {
  const { directoryPathToDelete, deleteDirectory, cancelDeleteDirectory } =
    useContext(ProjectContext);

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
