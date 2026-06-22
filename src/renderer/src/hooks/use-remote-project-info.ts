import { useContext } from 'react';

import { ProjectContext } from '../app-state';

export const useRemoteProjectInfo = () => {
  const { remoteProject, addRemoteProject } = useContext(ProjectContext);

  return {
    remoteProject,
    addRemoteProject,
  };
};
