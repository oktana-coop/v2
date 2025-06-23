import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../../../../modules/app-state';

export const useOpenDirectory = () => {
  const { openDirectory } = useContext(MultiDocumentProjectContext);

  return openDirectory;
};
