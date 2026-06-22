import { useCallback, useContext, useEffect, useState } from 'react';

import { MultiDocumentProjectContext } from '../app-state';

export const usePulledUpstreamChanges = () => {
  const {
    pulledUpstreamChanges: projectPulledUpstreamChanges,
    onHandlePulledUpstreamChanges,
  } = useContext(MultiDocumentProjectContext);

  const [pulledUpstreamChanges, setPulledUpstreamChanges] =
    useState<boolean>(false);

  useEffect(() => {
    // Only update state if pulled is true.
    // Each client of this hook is responsible for resetting the state to false.
    if (projectPulledUpstreamChanges) {
      setPulledUpstreamChanges(projectPulledUpstreamChanges);
    }
  }, [projectPulledUpstreamChanges]);

  const resetPulledUpstreamChangesInProjectContext = useCallback(
    () => onHandlePulledUpstreamChanges(),
    [onHandlePulledUpstreamChanges]
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
