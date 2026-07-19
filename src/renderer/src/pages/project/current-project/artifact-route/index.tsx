import { useContext, useEffect, useRef } from 'react';
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

  // Switching documents re-resolves the artifact, which would otherwise tear
  // the whole subtree down and flash a skeleton. Keep the previous one rendered
  // until the next resolves.
  const lastResolvedArtifact = useRef<ArtifactMetaData | null>(null);
  if (currentArtifact) {
    lastResolvedArtifact.current = currentArtifact;
  }

  const artifact = currentArtifact ?? lastResolvedArtifact.current;

  useEffect(() => {
    if (!resolvingCurrentArtifact && currentArtifact === null) {
      console.error('Could not resolve the artifact for the current route.');
    }
  }, [resolvingCurrentArtifact, currentArtifact]);

  if (artifact === null) {
    return resolvingCurrentArtifact ? (
      <LongTextSkeleton />
    ) : (
      <DocumentSelection />
    );
  }

  if (artifact.kind !== artifactKinds.RICH_TEXT_DOCUMENT) {
    // TODO: Use asset-specific views.
    return <UnsupportedDocumentView path={artifact.path} />;
  }

  return <Outlet context={{ artifact }} />;
};
