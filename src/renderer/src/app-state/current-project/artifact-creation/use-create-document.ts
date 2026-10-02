import { useContext } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router';

import { urlEncodeProjectId } from '../../../../../modules/domain/project';
import { ProjectContext } from '../context';

// New documents are named in the explorer, which only these pages show. The
// command palette (and its Cmd/Ctrl+N) can start one from any page, so on the
// others the documents view is opened first.
//
// TODO: Handle this case more cleanly (either with a UX solution or by
// leveraging app state)
const routesWithExplorer = [
  '/projects',
  '/projects/:projectId/artifacts/*',
  '/projects/:projectId/settings',
];

export const useCreateDocument = () => {
  const { projectId, directory, startCreateDocument } =
    useContext(ProjectContext);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const canCreateDocument = Boolean(
    directory && directory.permissionState === 'granted'
  );

  const handleStartCreateDocument = ({
    parentPath,
  }: { parentPath?: string } = {}) => {
    const showsExplorer = routesWithExplorer.some(
      (pattern) => matchPath(pattern, pathname) !== null
    );

    // The new document's name field only appears in the explorer.
    // Navigate to a route that shows it.
    if (!showsExplorer && projectId) {
      navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
    }

    startCreateDocument(parentPath);
  };

  return { canCreateDocument, startCreateDocument: handleStartCreateDocument };
};
