import { useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  type ProjectId,
  projectTypes,
  urlEncodeProjectId,
} from '../../../modules/domain/project';
import {
  type ResolvedArtifactId,
  urlEncodeArtifactId,
} from '../../../modules/infrastructure/version-control';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
} from '../app-state';

export const useNavigateToDocument = () => {
  const navigate = useNavigate();

  const { projectType } = useContext(CurrentProjectContext);
  const { setSelectedFileInfo } = useContext(MultiDocumentProjectContext);

  return ({
    projectId,
    documentId,
    path,
  }: {
    projectId: ProjectId;
    documentId: ResolvedArtifactId;
    path: string | null;
  }) => {
    if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
      setSelectedFileInfo({ documentId, path });
    }

    const newUrl = path
      ? `/projects/${urlEncodeProjectId(projectId)}/documents/${urlEncodeArtifactId(documentId)}?path=${encodeURIComponent(path)}`
      : `/projects/${urlEncodeProjectId(projectId)}/documents/${urlEncodeArtifactId(documentId)}`;

    navigate(newUrl);
  };
};
