import { useContext } from 'react';
import { useMatch } from 'react-router';

import {
  artifactKinds,
  type DocumentMetaData,
  isDocumentMetaData,
} from '../../../../modules/domain/project';
import { ProjectContext } from '../current-project/context';

// The current artifact, or null when the open artifact isn't a document.
// For routes outside the artifact subtree we also consider the current document null.
export const useCurrentDocumentMetaData = (): DocumentMetaData | null => {
  const { currentArtifact } = useContext(ProjectContext);
  const artifactRouteMatch = useMatch(
    '/projects/:projectId/artifacts/:artifactId/*'
  );

  return artifactRouteMatch &&
    currentArtifact &&
    isDocumentMetaData(currentArtifact)
    ? currentArtifact
    : null;
};

export const useCurrentRichTextDocumentId = () => {
  const document = useCurrentDocumentMetaData();

  return document?.kind === artifactKinds.RICH_TEXT_DOCUMENT
    ? document.id
    : null;
};

export const useCurrentDocumentId = () =>
  useCurrentDocumentMetaData()?.id ?? null;

export const useCurrentDocumentKind = () =>
  useCurrentDocumentMetaData()?.kind ?? null;
