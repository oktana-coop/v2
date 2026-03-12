import { useContext } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
} from '../app-state';

export const useRenameDocument = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const {
    filePathToRename,
    renameDocumentError,
    renameDocument: renameDocumentInMultiFileProject,
    cancelRenameDocument,
  } = useContext(MultiDocumentProjectContext);

  const renameDocument =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? renameDocumentInMultiFileProject
      : // TODO: handle single-document project rename
        async () => {};

  return {
    filePathToRename,
    renameDocumentError,
    renameDocument,
    cancelRenameDocument,
  };
};
