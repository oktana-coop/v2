import { describe, expect, it } from 'vitest';

import {
  type CommitWithUrlInfo,
  parseChangeId,
  parseCommitId,
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';
import { resolveDiffState } from './diff-state';

const makeCommit = (hex: string): CommitWithUrlInfo => ({
  id: parseCommitId(hex),
  message: `commit ${hex}`,
  time: new Date('2026-07-16T00:00:00Z'),
  urlEncodedChangeId: urlEncodeChangeId(parseChangeId(hex)),
});

// Newest first, matching how the app orders history.
const c1 = makeCommit('1111111');
const c2 = makeCommit('2222222');
const c3 = makeCommit('3333333');
const c4 = makeCommit('4444444');
const commits = [c1, c2, c3, c4];

describe('resolveDiffState', () => {
  it('shows no diff when there is no changeId', () => {
    expect(
      resolveDiffState({
        commits,
        changeId: null,
        userWantsDiff: true,
        diffWithParam: null,
      })
    ).toEqual({
      diffCommitId: null,
      canShowDiff: false,
      diffSelectorCommits: [],
    });
  });

  it('diffs a middle change against the next (older) commit', () => {
    expect(
      resolveDiffState({
        commits,
        changeId: parseChangeId('2222222'),
        userWantsDiff: true,
        diffWithParam: null,
      })
    ).toEqual({
      diffCommitId: c3.id,
      canShowDiff: true,
      diffSelectorCommits: [c3, c4],
    });
  });

  it('shows no diff when the change is the oldest commit in the list', () => {
    expect(
      resolveDiffState({
        commits,
        changeId: parseChangeId('4444444'),
        userWantsDiff: true,
        diffWithParam: null,
      })
    ).toEqual({
      diffCommitId: null,
      canShowDiff: false,
      diffSelectorCommits: [],
    });
  });

  it('diffs a change absent from the list against the most recent commit', () => {
    expect(
      resolveDiffState({
        commits,
        changeId: parseChangeId('uncommitted'),
        userWantsDiff: true,
        diffWithParam: null,
      })
    ).toEqual({
      diffCommitId: c1.id,
      canShowDiff: true,
      diffSelectorCommits: commits,
    });
  });

  it('shows no diff when the change is absent and there are no commits', () => {
    expect(
      resolveDiffState({
        commits: [],
        changeId: parseChangeId('uncommitted'),
        userWantsDiff: true,
        diffWithParam: null,
      })
    ).toEqual({
      diffCommitId: null,
      canShowDiff: false,
      diffSelectorCommits: [],
    });
  });

  it('can show a diff but selects none when the user has diff off', () => {
    expect(
      resolveDiffState({
        commits,
        changeId: parseChangeId('2222222'),
        userWantsDiff: false,
        diffWithParam: null,
      })
    ).toEqual({
      diffCommitId: null,
      canShowDiff: true,
      diffSelectorCommits: [c3, c4],
    });
  });

  it('honors an explicit diffWith target over the default', () => {
    // c2's default diff target is c3; override it to c4 (further back).
    expect(
      resolveDiffState({
        commits,
        changeId: parseChangeId('2222222'),
        userWantsDiff: true,
        diffWithParam: c4.id,
      })
    ).toEqual({
      diffCommitId: c4.id,
      canShowDiff: true,
      diffSelectorCommits: [c3, c4],
    });
  });
});
