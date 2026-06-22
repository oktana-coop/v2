import { useContext } from 'react';

import { ProjectContext } from '../app-state';

export const useOpenDirectory = () => {
  const { openDirectory } = useContext(ProjectContext);

  return openDirectory;
};
