import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../../../../../../../modules/app-state';

export const MultiDocumentProjectFileExplorerTitle = () => {
  const { directory } = useContext(MultiDocumentProjectContext);

  return <>{directory?.name ?? 'Files'}</>;
};
