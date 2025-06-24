import { useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useCreateDocument = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const [canCreateDocument, setCanCreateDocument] = useState<boolean>(false);

  const { createNewDocument: createNewDocumentInMultiFileProject, directory } =
    useContext(MultiDocumentProjectContext);
  const { createNewDocument: createNewDocumentInSingleFileProject } =
    useContext(SingleDocumentProjectContext);

  const createNewDocument =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? createNewDocumentInMultiFileProject
      : createNewDocumentInSingleFileProject;

  useEffect(() => {
    if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
      setCanCreateDocument(
        Boolean(directory && directory.permissionState === 'granted')
      );
    } else {
      setCanCreateDocument(true);
    }
  }, [directory, projectType]);

  return {
    canCreateDocument,
    createNewDocument,
  };
};
