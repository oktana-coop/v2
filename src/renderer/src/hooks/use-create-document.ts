import { useContext } from 'react';

import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../../../modules/app-state';
import { projectTypes } from '../../../modules/domain/project';

export const useCreateDocument = () => {
  const { projectType } = useContext(CurrentProjectContext);

  const { createNewDocument: createNewDocumentInMultiFileProject } = useContext(
    MultiDocumentProjectContext
  );
  const { createNewDocument: createNewDocumentInSingleFileProject } =
    useContext(SingleDocumentProjectContext);

  return projectType === projectTypes.MULTI_DOCUMENT_PROJECT
    ? createNewDocumentInMultiFileProject
    : createNewDocumentInSingleFileProject;
};
