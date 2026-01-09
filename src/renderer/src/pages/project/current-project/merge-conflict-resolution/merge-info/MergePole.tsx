import {
  type Branch,
  type CommitId,
  getShortenedCommitId,
} from '../../../../../../../modules/infrastructure/version-control';
import { Badge } from '../../../../../components/highlighting/Badge';

export const MergePole = ({
  branch,
  commitId,
}: {
  branch?: Branch;
  commitId: CommitId;
}) => <Badge>{branch ?? getShortenedCommitId(commitId)}</Badge>;
