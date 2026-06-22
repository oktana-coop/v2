import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../app-state';

export const useRenameDocument = () => {
  const {
    filePathToRename,
    renameDocumentError,
    renameDocument,
    cancelRenameDocument,
  } = useContext(MultiDocumentProjectContext);

  return {
    filePathToRename,
    renameDocumentError,
    renameDocument,
    cancelRenameDocument,
  };
};
