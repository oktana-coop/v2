import * as Effect from 'effect/Effect';
import { useCallback } from 'react';

import {
  type Commit,
  UNCOMMITTED_CHANGE_ID,
} from '../../../../modules/infrastructure/version-control';
import { type ProjectContextType } from './types';

type HistoryDeps = Pick<
  ProjectContextType,
  'projectId' | 'projectStore' | 'currentBranch'
>;

type HistoryOps = Pick<
  ProjectContextType,
  | 'getProjectHistory'
  | 'getProjectChangedDocuments'
  | 'getProjectUncommittedChanges'
>;

export const useHistoryOps = ({
  projectId,
  projectStore,
  currentBranch,
}: HistoryDeps): HistoryOps => {
  const getProjectHistory = useCallback(async () => {
    if (!projectStore || !projectId || !currentBranch) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot get project history.'
      );
    }
    return Effect.runPromise(
      projectStore.getProjectCommitHistory({
        projectId,
        branch: currentBranch,
      })
    );
  }, [projectStore, projectId, currentBranch]);

  const getProjectChangedDocuments = useCallback(
    async (changeId: Commit['id']) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot get changed documents.'
        );
      }
      return Effect.runPromise(
        projectStore.getChangedDocumentsAtChange({
          projectId,
          changeId,
        })
      );
    },
    [projectStore, projectId]
  );

  const getProjectUncommittedChanges = useCallback(async () => {
    if (!projectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot get uncommitted changes.'
      );
    }
    return Effect.runPromise(
      projectStore.getChangedDocumentsAtChange({
        projectId,
        changeId: UNCOMMITTED_CHANGE_ID,
      })
    );
  }, [projectStore, projectId]);

  return {
    getProjectHistory,
    getProjectChangedDocuments,
    getProjectUncommittedChanges,
  };
};
