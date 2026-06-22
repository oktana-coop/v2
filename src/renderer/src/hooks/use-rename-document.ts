import { useContext } from 'react';

import { ProjectContext } from '../app-state';

export const useRenameDocument = () => {
  const {
    filePathToRename,
    renameDocumentError,
    renameDocument,
    cancelRenameDocument,
  } = useContext(ProjectContext);

  return {
    filePathToRename,
    renameDocumentError,
    renameDocument,
    cancelRenameDocument,
  };
};
