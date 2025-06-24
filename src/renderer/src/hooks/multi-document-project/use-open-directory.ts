import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../../../app-state';

export const useOpenDirectory = () => {
  const { openDirectory } = useContext(MultiDocumentProjectContext);

  return openDirectory;
};
