import { useNavigate } from 'react-router';

import {
  type ProjectId,
  urlEncodeProjectId,
} from '../../../modules/domain/project';
import { type MergeConflictInfo } from '../../../modules/infrastructure/version-control';

const buildResolveConlictsUrl = ({
  projectId,
  mergeConflictInfo,
}: {
  projectId: ProjectId;
  mergeConflictInfo: MergeConflictInfo;
}) => {
  const resolveConflictsBaseUrl = `/projects/${urlEncodeProjectId(projectId)}/merge?source=${mergeConflictInfo.sourceCommitId}&target=${mergeConflictInfo.targetCommitId}&commonAncestor=${mergeConflictInfo.commonAncestorCommitId}`;

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
  }: {
    projectId: ProjectId;
    mergeConflictInfo: MergeConflictInfo;
  }) => {
    const resolveConflictsUrl = buildResolveConlictsUrl({
      projectId,
      mergeConflictInfo,
    });
    navigate(resolveConflictsUrl);
  };
};
