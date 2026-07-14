import { useEffect } from 'react';
import { Outlet } from 'react-router';

import { versionedArtifactTypes } from '../../../../../../modules/infrastructure/version-control';
import { useArtifactType } from '../../../../hooks/use-artifact-type';
import { DocumentSelection } from '../../empty-views/document-selection';
import { UnsupportedDocumentView } from '../../shared/unsupported-document-view';

// Dispatches the artifact route by type: rich-text documents render the editor
// subtree (Outlet), while anything else (e.g. image assets) renders a viewer.
// For now non-documents fall back to the unsupported-document view. When the
// type cannot be determined, that is an unexpected state — we surface it in the
// console and render the empty view rather than guessing.
export const ArtifactRoute = () => {
  const { artifactType, loading } = useArtifactType();

  useEffect(() => {
    if (!loading && artifactType === null) {
      console.error(
        'Could not determine the artifact type for the current route.'
      );
    }
  }, [loading, artifactType]);

  // Still resolving the artifact's type (an async store lookup).
  if (loading) {
    return null;
  }

  if (artifactType === null) {
    return <DocumentSelection />;
  }

  if (artifactType !== versionedArtifactTypes.RICH_TEXT_DOCUMENT) {
    // TODO: Use asset-specific views.
    return <UnsupportedDocumentView />;
  }

  return <Outlet />;
};
