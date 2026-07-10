import { useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  type ProjectId,
  urlEncodeProjectId,
} from '../../../modules/domain/project';
import {
  type ResolvedArtifactId,
  urlEncodeArtifactId,
} from '../../../modules/infrastructure/version-control';
import { ProjectContext } from '../app-state';

export const useNavigateToArtifact = () => {
  const navigate = useNavigate();

  const { setSelectedFileInfo } = useContext(ProjectContext);

  return ({
    projectId,
    artifactId,
    path,
  }: {
    projectId: ProjectId;
    artifactId: ResolvedArtifactId;
    path: string | null;
  }) => {
    setSelectedFileInfo({ documentId: artifactId, path });

    navigate(
      `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(artifactId)}`
    );
  };
};
