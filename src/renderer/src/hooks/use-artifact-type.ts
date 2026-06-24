import { useParams, useSearchParams } from 'react-router';

import { inferArtifactTypeFromExtension } from '../../../modules/domain/project';
import {
  decodeUrlEncodedArtifactId,
  decomposeGitBlobRef,
  isGitBlobRef,
  type VersionedArtifactType,
} from '../../../modules/infrastructure/version-control';

// Derives the type of the artifact currently in the route, or null when it
// cannot be determined. Classification is by path, taken from the git blob ref
// or the `path` query param.
export const useArtifactType = (): VersionedArtifactType | null => {
  const { artifactId: urlEncodedArtifactId } = useParams();
  const [searchParams] = useSearchParams();

  const artifactId = urlEncodedArtifactId
    ? decodeUrlEncodedArtifactId(urlEncodedArtifactId)
    : null;
  const pathParam = searchParams.get('path');
  const path =
    artifactId && isGitBlobRef(artifactId)
      ? decomposeGitBlobRef(artifactId).path
      : pathParam
        ? decodeURIComponent(pathParam)
        : null;

  return path ? inferArtifactTypeFromExtension(path) : null;
};
