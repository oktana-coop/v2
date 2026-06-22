import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../app-state';

export const useRemoteProjectInfo = () => {
  const { remoteProject, addRemoteProject } = useContext(
    MultiDocumentProjectContext
  );

  return {
    remoteProject,
    addRemoteProject,
  };
};
