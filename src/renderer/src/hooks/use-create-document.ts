import { useContext, useEffect, useState } from 'react';

import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../../../modules/app-state';
import { projectTypes } from '../../../modules/domain/project';

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
