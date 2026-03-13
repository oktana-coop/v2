import { useContext } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
} from '../app-state';

export const useDeleteDirectory = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const {
    directoryPathToDelete,
    deleteDirectory: deleteDirectoryInMultiFileProject,
    cancelDeleteDirectory,
  } = useContext(MultiDocumentProjectContext);

  const deleteDirectory =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? deleteDirectoryInMultiFileProject
      : async () => {};

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
