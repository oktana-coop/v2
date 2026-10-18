import { useNavigate } from 'react-router';

import {
  type ProjectId,
  urlEncodeProjectId,
} from '../../../../../modules/domain/project';
import {
  type ArtifactId,
  urlEncodeArtifactId,
} from '../../../../../modules/infrastructure/version-control';

export const useNavigateToArtifact = () => {
  const navigate = useNavigate();

  return ({
    projectId,
    artifactId,
  }: {
    projectId: ProjectId;
    artifactId: ArtifactId;
  }) => {
    navigate(
      `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(artifactId)}`
    );
  };
};
