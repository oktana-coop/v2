import {
  type ChangeId,
  type CommitId,
  type CommitWithUrlInfo,
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';

export type DiffState = {
  diffCommitId: CommitId | null;
  canShowDiff: boolean;
  diffSelectorCommits: CommitWithUrlInfo[];
};

export const resolveDiffState = ({
  commits,
  changeId,
  userWantsDiff,
  diffWithParam,
}: {
  commits: CommitWithUrlInfo[];
  changeId: ChangeId | null;
  userWantsDiff: boolean;
  diffWithParam: CommitId | null;
}): DiffState => {
  const noDiff = {
    diffCommitId: null,
    canShowDiff: false,
    diffSelectorCommits: [] as CommitWithUrlInfo[],
  };

  if (!changeId) return noDiff;

  const key = urlEncodeChangeId(changeId);
  const currentIndex = commits.findIndex((c) => c.urlEncodedChangeId === key);

  let defaultDiffCommitId: CommitId | null;
  let diffSelectorCommits: CommitWithUrlInfo[];

  if (currentIndex < 0) {
    // Current change not in list (e.g. uncommitted in project history) —
    // diff against the most recent commit; all commits are eligible.
    defaultDiffCommitId = commits.length > 0 ? commits[0].id : null;
    diffSelectorCommits = commits;
  } else if (currentIndex >= commits.length - 1) {
    // Current change is the oldest in the list — nothing to diff against.
    return noDiff;
  } else {
    // Normal case — diff against the next (older) commit.
    defaultDiffCommitId = commits[currentIndex + 1].id;
    diffSelectorCommits = commits.slice(currentIndex + 1);
  }

  if (!defaultDiffCommitId) return noDiff;

  const resolvedDiffCommit = diffWithParam ?? defaultDiffCommitId;

  return {
    diffCommitId: userWantsDiff ? resolvedDiffCommit : null,
    canShowDiff: true,
    diffSelectorCommits,
  };
};
