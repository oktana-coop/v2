import { useContext } from 'react';

import { CurrentDocumentContext } from '../../../../modules/app-state';

export const useCurrentDocumentName = () => {
  const { selectedFileName } = useContext(CurrentDocumentContext);

  return () => {
    return selectedFileName;
  };
};
