import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../app-state';

export const useLoadingProject = () => {
  const { loading } = useContext(MultiDocumentProjectContext);
  return loading;
};
