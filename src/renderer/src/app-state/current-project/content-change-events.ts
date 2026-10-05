import { useCallback } from 'react';

import { subscribeToStream } from '../../../../utils/effect';
import { type ProjectContextType } from './types';

type ContentChangeEventsDeps = Pick<
  ProjectContextType,
  'projectId' | 'projectStore'
>;

type ContentChangeEventsOps = Pick<
  ProjectContextType,
  'subscribeToProjectContentChangeEvents'
>;

export const useContentChangeEventsOps = ({
  projectId,
  projectStore,
}: ContentChangeEventsDeps): ContentChangeEventsOps => {
  const subscribeToProjectContentChangeEvents = useCallback<
    ProjectContextType['subscribeToProjectContentChangeEvents']
  >(
    ({ emitOnStart, onEvent }) => {
      if (!projectId || !projectStore) return () => {};

      return subscribeToStream(
        projectStore.projectContentChangeEvents({ projectId, emitOnStart }),
        onEvent
      );
    },
    [projectId, projectStore]
  );

  return { subscribeToProjectContentChangeEvents };
};
