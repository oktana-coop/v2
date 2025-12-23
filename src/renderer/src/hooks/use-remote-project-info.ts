import { useCallback, useContext, useEffect, useState } from 'react';

import {
  projectTypes,
  type RemoteProjectInfo,
} from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const useRemoteProjectInfo = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const {
    remoteProject: multiDocumentProjectRemoteProject,
    addRemoteProject: addRemoteProjectInMultiDocumentProject,
  } = useContext(MultiDocumentProjectContext);

  const {
    remoteProject: singleDocumentProjectRemoteProject,
    addRemoteProject: addRemoteProjectInSingleDocumentProject,
  } = useContext(SingleDocumentProjectContext);

  const [remoteProject, setRemoteProject] = useState<RemoteProjectInfo | null>(
    null
  );

  useEffect(() => {
    const origin =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? multiDocumentProjectRemoteProject
        : singleDocumentProjectRemoteProject;
    setRemoteProject(origin);
  }, [
    multiDocumentProjectRemoteProject,
    singleDocumentProjectRemoteProject,
    projectType,
  ]);

  const addRemoteProject = useCallback(
    (url: string) =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? addRemoteProjectInMultiDocumentProject(url)
        : addRemoteProjectInSingleDocumentProject(url),
    [
      projectType,
      addRemoteProjectInMultiDocumentProject,
      addRemoteProjectInSingleDocumentProject,
    ]
  );

  return {
    remoteProject,
    addRemoteProject,
  };
};
