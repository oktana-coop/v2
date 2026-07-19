import { useContext } from 'react';

import { artifactKinds } from '../../../../modules/domain/project';
import { ProjectContext } from '../current-project/context';

// The current artifact's id, or null when the open artifact isn't a document.
export const useCurrentDocumentId = () => {
  const { currentArtifact } = useContext(ProjectContext);

  return currentArtifact?.kind === artifactKinds.RICH_TEXT_DOCUMENT
    ? currentArtifact.id
    : null;
};
