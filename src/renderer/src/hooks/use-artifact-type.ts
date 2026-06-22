import { useParams, useSearchParams } from 'react-router';

import { inferArtifactTypeFromExtension } from '../../../modules/domain/project';
import {
  decodeUrlEncodedArtifactId,
  decomposeGitBlobRef,
  isGitBlobRef,
  type VersionedArtifactType,
} from '../../../modules/infrastructure/version-control';

// Derives the type of the artifact currently in the route, or null when it
// cannot be determined. Classification is by path, which both git (encoded in
// the blob ref) and Automerge (provided via the `path` query param) supply.
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
