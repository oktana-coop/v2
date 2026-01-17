import { useNavigate } from 'react-router';

import {
  type ProjectId,
  urlEncodeProjectId,
} from '../../../modules/domain/project';
import {
  isCompareContentConflict,
  isStructuralConflict,
  type MergeConflictInfo,
} from '../../../modules/infrastructure/version-control';

const selectDefaultSubRoute = ({
  mergeConflictInfo,
  baseMergeRoute,
}: {
  mergeConflictInfo: MergeConflictInfo;
  baseMergeRoute: string;
}) => {
  const hasStructuralConflicts = Boolean(
    mergeConflictInfo.conflicts.find((conflict) =>
      isStructuralConflict(conflict)
    )
  );

  const firstCompareContentConflictPath = mergeConflictInfo.conflicts.find(
    (conflict) => isCompareContentConflict(conflict)
  )?.path;

  const mergeRoute = hasStructuralConflicts
    ? `${baseMergeRoute}/structural`
    : `${baseMergeRoute}${firstCompareContentConflictPath ? `/${firstCompareContentConflictPath}` : ''}`;

  return mergeRoute;
};

const buildResolveConlictsUrl = ({
  projectId,
  mergeConflictInfo,
  subRoute,
}: {
  projectId: ProjectId;
  mergeConflictInfo: MergeConflictInfo;
  subRoute?: string;
}) => {
  const baseMergeRoute = 'merge';
  const mergeRoute = subRoute
    ? `${baseMergeRoute}/${subRoute}`
    : selectDefaultSubRoute({ mergeConflictInfo, baseMergeRoute });
  const resolveConflictsBaseUrl = `/projects/${urlEncodeProjectId(projectId)}/${mergeRoute}?source=${mergeConflictInfo.sourceCommitId}&target=${mergeConflictInfo.targetCommitId}&commonAncestor=${mergeConflictInfo.commonAncestorCommitId}`;

  if (mergeConflictInfo.sourceBranch && mergeConflictInfo.targetBranch) {
    return `${resolveConflictsBaseUrl}&sourceBranch=${mergeConflictInfo.sourceBranch}&targetBranch=${mergeConflictInfo.targetBranch}`;
  }

  return resolveConflictsBaseUrl;
};

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
    const resolveConflictsUrl = buildResolveConlictsUrl({
      projectId,
      mergeConflictInfo,
      subRoute: selectSubRoute,
    });
    navigate(resolveConflictsUrl);
  };
};
