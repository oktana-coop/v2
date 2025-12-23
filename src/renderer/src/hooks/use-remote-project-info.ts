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
    originRemoteProjectInfo: multiDocumentOriginRemoteProjectInfo,
    addRemote: addRemoteInMultiDocumentProject,
  } = useContext(MultiDocumentProjectContext);

  const {
    originRemoteProjectInfo: singleDocumentOriginRemoteProjectInfo,
    addRemote: addRemoteInSingleDocumentProject,
  } = useContext(SingleDocumentProjectContext);

  const [originRemoteInfo, setOriginRemoteInfo] =
    useState<RemoteProjectInfo | null>(null);

  useEffect(() => {
    const origin =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? multiDocumentOriginRemoteProjectInfo
        : singleDocumentOriginRemoteProjectInfo;
    setOriginRemoteInfo(origin);
  }, [
    multiDocumentOriginRemoteProjectInfo,
    singleDocumentOriginRemoteProjectInfo,
    projectType,
  ]);

  const addRemote = useCallback(
    (url: string) =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? addRemoteInMultiDocumentProject(url)
        : addRemoteInSingleDocumentProject(url),
    [
      projectType,
      addRemoteInMultiDocumentProject,
      addRemoteInSingleDocumentProject,
    ]
  );

  return {
    originRemoteInfo,
    addRemote,
  };
};
