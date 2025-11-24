import { useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useLoadingProject = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { loading: multiDocumentProjectLoading } = useContext(
    MultiDocumentProjectContext
  );
  const { loading: singleDocumentProjectLoading } = useContext(
    SingleDocumentProjectContext
  );

  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const projectLoading =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? multiDocumentProjectLoading
        : singleDocumentProjectLoading;
    setLoading(projectLoading);
  }, [multiDocumentProjectLoading, singleDocumentProjectLoading, projectType]);

  return loading;
};
