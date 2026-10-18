import { useNavigate } from 'react-router';

import { type ProjectId } from '../../../../../modules/domain/project';
import { type MergeConflictInfo } from '../../../../../modules/infrastructure/version-control';
import { buildResolveConflictsUrl } from './resolve-conflicts-url';

export const useNavigateToResolveConflicts = () => {
  const navigate = useNavigate();

  return ({
    projectId,
    mergeConflictInfo,
    selectSubRoute,
  }: {
    projectId: ProjectId;
    mergeConflictInfo: MergeConflictInfo;
    selectSubRoute?: string;
  }) => {
    const resolveConflictsUrl = buildResolveConflictsUrl({
      projectId,
      mergeConflictInfo,
      subRoute: selectSubRoute,
    });
    navigate(resolveConflictsUrl);
  };
};
