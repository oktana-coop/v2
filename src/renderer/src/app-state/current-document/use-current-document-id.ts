import { useContext } from 'react';
import { useMatch } from 'react-router';

import { artifactKinds } from '../../../../modules/domain/project';
import { ProjectContext } from '../current-project/context';

// The current artifact's id, or null when the open artifact isn't a document.
// For routes outside the artifact subtree we also consider the current document null.
export const useCurrentDocumentId = () => {
  const { currentArtifact } = useContext(ProjectContext);
  const artifactRouteMatch = useMatch(
    '/projects/:projectId/artifacts/:artifactId/*'
  );

  return artifactRouteMatch &&
    currentArtifact?.kind === artifactKinds.RICH_TEXT_DOCUMENT
    ? currentArtifact.id
    : null;
};
