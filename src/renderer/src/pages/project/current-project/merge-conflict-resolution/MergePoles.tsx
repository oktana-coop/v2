import {
  getShortenedCommitId,
  MergeConflictInfo,
} from '../../../../../../modules/infrastructure/version-control';
import { Badge } from '../../../../components/highlighting/Badge';
import { ArrowLongRight } from '../../../../components/icons';

export const MergePoles = ({
  mergeConflictInfo,
}: {
  mergeConflictInfo: MergeConflictInfo;
}) => (
  <span className="inline-flex">
    <Badge>
      {mergeConflictInfo.sourceBranch ??
        getShortenedCommitId(mergeConflictInfo.sourceCommitId)}
    </Badge>
    <span className="mx-1">
      <ArrowLongRight />
    </span>
    <Badge>
      {mergeConflictInfo.targetBranch ??
        getShortenedCommitId(mergeConflictInfo.targetCommitId)}
    </Badge>
  </span>
);
