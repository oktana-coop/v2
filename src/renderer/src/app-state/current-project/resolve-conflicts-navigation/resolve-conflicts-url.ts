import {
  type ProjectId,
  urlEncodeProjectId,
} from '../../../../../modules/domain/project';
import {
  isCompareContentConflict,
  isStructuralConflict,
  type MergeConflictInfo,
} from '../../../../../modules/infrastructure/version-control';

export const selectDefaultSubRoute = ({
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
    : `${baseMergeRoute}${firstCompareContentConflictPath ? `/${encodeURIComponent(firstCompareContentConflictPath)}` : ''}`;

  return mergeRoute;
};

export const buildResolveConflictsUrl = ({
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
    ? `${baseMergeRoute}/${encodeURIComponent(subRoute)}`
    : selectDefaultSubRoute({ mergeConflictInfo, baseMergeRoute });
  const resolveConflictsBaseUrl = `/projects/${urlEncodeProjectId(projectId)}/${mergeRoute}?source=${mergeConflictInfo.sourceCommitId}&target=${mergeConflictInfo.targetCommitId}&commonAncestor=${mergeConflictInfo.commonAncestorCommitId}`;

  if (mergeConflictInfo.sourceBranch && mergeConflictInfo.targetBranch) {
    return `${resolveConflictsBaseUrl}&sourceBranch=${mergeConflictInfo.sourceBranch}&targetBranch=${mergeConflictInfo.targetBranch}`;
  }

  return resolveConflictsBaseUrl;
};
