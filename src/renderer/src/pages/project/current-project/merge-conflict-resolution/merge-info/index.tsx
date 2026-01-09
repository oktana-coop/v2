import { MergeConflictInfo } from '../../../../../../../modules/infrastructure/version-control';
import { ArrowLongRight } from '../../../../../components/icons';
import { MergePole } from './MergePole';

export const MergeInfo = ({
  mergeConflictInfo,
}: {
  mergeConflictInfo: MergeConflictInfo;
}) => (
  <span className="inline-flex">
    <MergePole
      branch={mergeConflictInfo.sourceBranch}
      commitId={mergeConflictInfo.sourceCommitId}
    />
    <span className="mx-1">
      <ArrowLongRight />
    </span>
    <MergePole
      branch={mergeConflictInfo.targetBranch}
      commitId={mergeConflictInfo.targetCommitId}
    />
  </span>
);
