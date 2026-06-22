import { useContext } from 'react';

import { ProjectContext } from '../app-state';

export const useProjectId = () => {
  const { projectId } = useContext(ProjectContext);
  return projectId;
};
