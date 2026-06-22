import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../app-state';

export const useDeleteDocument = () => {
  const {
    filePathToDelete,
    deleteDocument: deleteDocumentInProject,
    cancelDeleteDocument,
  } = useContext(MultiDocumentProjectContext);

  const deleteDocument = () => {
    if (filePathToDelete) {
      deleteDocumentInProject({ relativePath: filePathToDelete });
    }
  };

  return {
    filePathToDelete,
    deleteDocument,
    cancelDeleteDocument,
  };
};
