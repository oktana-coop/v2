import { useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import { ElectronContext } from '../../../modules/infrastructure/cross-platform/browser';
import {
  CreateDocumentModalContext,
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';
import { useNavigateToDocument } from './use-navigate-to-document';

export const useCreateDocument = () => {
  const { isElectron } = useContext(ElectronContext);
  const { projectType } = useContext(CurrentProjectContext);
  const { openCreateDocumentModal } = useContext(CreateDocumentModalContext);
  const [canCreateDocument, setCanCreateDocument] = useState<boolean>(false);
  const navigateToDocument = useNavigateToDocument();

  const { createNewDocument: createNewDocumentInMultiFileProject, directory } =
    useContext(MultiDocumentProjectContext);
  const { createNewDocument: createNewDocumentInSingleFileProject } =
    useContext(SingleDocumentProjectContext);

  const createNewDocument =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? createNewDocumentInMultiFileProject
      : createNewDocumentInSingleFileProject;

  const triggerDocumentCreationDialog = async (cloneUrl?: string) => {
    if (!isElectron && projectType === projectTypes.SINGLE_DOCUMENT_PROJECT) {
      openCreateDocumentModal();
    } else {
      const { projectId, documentId, path } = await createNewDocument({
        cloneUrl,
      });
      navigateToDocument({ projectId, documentId, path });
    }
  };

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
    triggerDocumentCreationDialog,
  };
};
