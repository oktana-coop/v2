import { useContext } from 'react';
import { useParams, useSearchParams } from 'react-router';

import {
  inferArtifactTypeFromExtension,
  projectTypes,
} from '../../../modules/domain/project';
import {
  decodeUrlEncodedArtifactId,
  decomposeGitBlobRef,
  isGitBlobRef,
  type VersionedArtifactType,
  versionedArtifactTypes,
} from '../../../modules/infrastructure/version-control';
import { CurrentProjectContext } from '../app-state';

// Derives the type of the artifact currently in the route, or null when it
// cannot be determined. Classification is by path, which both git (encoded in
// the blob ref) and Automerge (provided via the `path` query param) supply.
export const useArtifactType = (): VersionedArtifactType | null => {
  const { projectType } = useContext(CurrentProjectContext);
  const { artifactId: urlEncodedArtifactId } = useParams();
  const [searchParams] = useSearchParams();

  // A single-document project is, by definition, its sole document.
  if (projectType === projectTypes.SINGLE_DOCUMENT_PROJECT) {
    return versionedArtifactTypes.RICH_TEXT_DOCUMENT;
  }

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
