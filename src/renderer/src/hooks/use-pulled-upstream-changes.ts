import { useCallback, useContext, useEffect, useState } from 'react';

import { projectTypes } from '../../../modules/domain/project';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../app-state';

export const usePulledUpstreamChanges = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const {
    pulledUpstreamChanges: multiDocumentProjectPulledUpstreamChanges,
    onHandlePulledUpstreamChanges:
      onHandleMultiDocumentProjectPulledUpstreamChanges,
  } = useContext(MultiDocumentProjectContext);

  const {
    pulledUpstreamChanges: singleDocumentProjectPulledUpstreamChanges,
    onHandlePulledUpstreamChanges:
      onHandleSingleDocumentProjectPulledUpstreamChanges,
  } = useContext(SingleDocumentProjectContext);

  const [pulledUpstreamChanges, setPulledUpstreamChanges] =
    useState<boolean>(false);

  useEffect(() => {
    const pulled =
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? multiDocumentProjectPulledUpstreamChanges
        : singleDocumentProjectPulledUpstreamChanges;

    // Only update state if pulled is true.
    // Each client of this hook is responsible for resetting the state to false.
    if (pulled) {
      setPulledUpstreamChanges(pulled);
    }
  }, [
    multiDocumentProjectPulledUpstreamChanges,
    singleDocumentProjectPulledUpstreamChanges,
    projectType,
  ]);

  const resetPulledUpstreamChangesInProjectContext = useCallback(
    () =>
      projectType === projectTypes.MULTI_DOCUMENT_PROJECT
        ? onHandleMultiDocumentProjectPulledUpstreamChanges()
        : onHandleSingleDocumentProjectPulledUpstreamChanges(),
    [
      projectType,
      onHandleMultiDocumentProjectPulledUpstreamChanges,
      onHandleSingleDocumentProjectPulledUpstreamChanges,
    ]
  );

  const handleResetPulledUpstreamChanges = () => {
    setPulledUpstreamChanges(false);
    resetPulledUpstreamChangesInProjectContext();
  };

  return {
    pulledUpstreamChanges,
    resetPulledUpstreamChanges: handleResetPulledUpstreamChanges,
  };
};
