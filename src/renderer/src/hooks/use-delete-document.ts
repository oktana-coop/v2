import { useContext } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
} from '../app-state';

export const useDeleteDocument = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const {
    filePathToDelete,
    deleteDocument: deleteDocumentInMultiFileProject,
    cancelDeleteDocument,
  } = useContext(MultiDocumentProjectContext);

  const deleteDocumentInProject =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? deleteDocumentInMultiFileProject
      : // TODO: handle single-document project deletion
        async () => {};

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
