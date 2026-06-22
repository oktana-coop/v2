import { useContext } from 'react';

import { ProjectContext } from '../app-state';

export const useDeleteDocument = () => {
  const {
    filePathToDelete,
    deleteDocument: deleteDocumentInProject,
    cancelDeleteDocument,
  } = useContext(ProjectContext);

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
