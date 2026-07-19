import { useContext, useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router';

import {
  artifactKinds,
  type ArtifactMetaData,
} from '../../../../../../modules/domain/project';
import { ProjectContext } from '../../../../app-state';
import { LongTextSkeleton } from '../../../../components/progress/skeletons/LongText';
import { DocumentSelection } from '../../empty-views/document-selection';
import { UnsupportedDocumentView } from '../../shared/unsupported-document-view';

// What every view under this route can rely on: an artifact that is already
// resolved. Nothing below here needs to await a path or handle a null one.
export type ArtifactOutletContext = {
  artifact: ArtifactMetaData;
};

export const useCurrentArtifact = (): ArtifactMetaData =>
  useOutletContext<ArtifactOutletContext>().artifact;

// Dispatches the artifact route by type: rich-text documents render the editor
// subtree (Outlet), while anything else (e.g. image assets) renders a viewer.
// For now non-documents fall back to the unsupported-document view. When the
// artifact cannot be resolved, that is an unexpected state — we surface it in
// the console and render the empty view rather than guessing.
export const ArtifactRoute = () => {
  const { currentArtifact, resolvingCurrentArtifact } =
    useContext(ProjectContext);

  useEffect(() => {
    if (!resolvingCurrentArtifact && currentArtifact === null) {
      console.error('Could not resolve the artifact for the current route.');
    }
  }, [resolvingCurrentArtifact, currentArtifact]);

  if (currentArtifact === null) {
    return resolvingCurrentArtifact ? (
      <LongTextSkeleton />
    ) : (
      <DocumentSelection />
    );
  }

  if (currentArtifact.kind !== artifactKinds.RICH_TEXT_DOCUMENT) {
    // TODO: Use asset-specific views.
    return <UnsupportedDocumentView path={currentArtifact.path} />;
  }

  return <Outlet context={{ artifact: currentArtifact }} />;
};
