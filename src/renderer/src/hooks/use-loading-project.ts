import { useContext } from 'react';

import { ProjectContext } from '../app-state';

export const useLoadingProject = () => {
  const { loading } = useContext(ProjectContext);
  return loading;
};
