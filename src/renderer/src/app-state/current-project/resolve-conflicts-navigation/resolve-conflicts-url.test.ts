import { describe, expect, it } from 'vitest';

import { parseProjectId } from '../../../../../modules/domain/project';
import {
  type MergeConflict,
  type MergeConflictInfo,
  parseArtifactId,
  parseBranch,
  parseCommitId,
} from '../../../../../modules/infrastructure/version-control';
import {
  buildResolveConflictsUrl,
  selectDefaultSubRoute,
} from './resolve-conflicts-url';

const projectId = parseProjectId('/proj'); // url-encodes to '%2Fproj'

const structuralConflict: MergeConflict = {
  kind: 'file/directory',
  filePath: 'a.txt',
  directoryPath: 'a',
};

const contentConflict = (path: string): MergeConflict => ({
  kind: 'add/add',
  sourceArtifactId: parseArtifactId('s'),
  targetArtifactId: parseArtifactId('t'),
  path,
});

const makeInfo = (
  conflicts: MergeConflict[],
  branches?: { sourceBranch: string; targetBranch: string }
): MergeConflictInfo => ({
  sourceCommitId: parseCommitId('aaaaaaa'),
  targetCommitId: parseCommitId('bbbbbbb'),
  commonAncestorCommitId: parseCommitId('ccccccc'),
  conflicts,
  ...(branches
    ? {
        sourceBranch: parseBranch(branches.sourceBranch),
        targetBranch: parseBranch(branches.targetBranch),
      }
    : {}),
});

const baseParams = 'source=aaaaaaa&target=bbbbbbb&commonAncestor=ccccccc';

describe('buildResolveConflictsUrl', () => {
  it('uses an explicit subRoute when provided', () => {
    const url = buildResolveConflictsUrl({
      projectId,
      mergeConflictInfo: makeInfo([]),
      subRoute: 'structural',
    });
    expect(url).toBe(`/projects/%2Fproj/merge/structural?${baseParams}`);
  });

  it('routes to /structural by default when there is a structural conflict', () => {
    const url = buildResolveConflictsUrl({
      projectId,
      mergeConflictInfo: makeInfo([structuralConflict]),
    });
    expect(url).toBe(`/projects/%2Fproj/merge/structural?${baseParams}`);
  });

  it("defaults to the first content conflict's path when there is no structural conflict", () => {
    const url = buildResolveConflictsUrl({
      projectId,
      mergeConflictInfo: makeInfo([contentConflict('notes.md')]),
    });
    expect(url).toBe(`/projects/%2Fproj/merge/notes.md?${baseParams}`);
  });

  it('url-encodes the content conflict path', () => {
    const url = buildResolveConflictsUrl({
      projectId,
      mergeConflictInfo: makeInfo([contentConflict('dir/file.md')]),
    });
    expect(url).toBe(`/projects/%2Fproj/merge/dir%2Ffile.md?${baseParams}`);
  });

  it('routes to bare /merge when there are no conflicts', () => {
    const url = buildResolveConflictsUrl({
      projectId,
      mergeConflictInfo: makeInfo([]),
    });
    expect(url).toBe(`/projects/%2Fproj/merge?${baseParams}`);
  });

  it('prefers structural over content when both are present', () => {
    const url = buildResolveConflictsUrl({
      projectId,
      mergeConflictInfo: makeInfo([
        contentConflict('notes.md'),
        structuralConflict,
      ]),
    });
    expect(url).toBe(`/projects/%2Fproj/merge/structural?${baseParams}`);
  });

  it('appends branch params when both source and target branches are set', () => {
    const url = buildResolveConflictsUrl({
      projectId,
      mergeConflictInfo: makeInfo([], {
        sourceBranch: 'feature',
        targetBranch: 'main',
      }),
      subRoute: 'structural',
    });
    expect(url).toBe(
      `/projects/%2Fproj/merge/structural?${baseParams}&sourceBranch=feature&targetBranch=main`
    );
  });

  it('omits branch params when only one branch is set', () => {
    const mergeConflictInfo: MergeConflictInfo = {
      sourceCommitId: parseCommitId('aaaaaaa'),
      targetCommitId: parseCommitId('bbbbbbb'),
      commonAncestorCommitId: parseCommitId('ccccccc'),
      conflicts: [],
      sourceBranch: parseBranch('feature'),
    };
    const url = buildResolveConflictsUrl({
      projectId,
      mergeConflictInfo,
      subRoute: 'structural',
    });
    expect(url).toBe(`/projects/%2Fproj/merge/structural?${baseParams}`);
  });
});

describe('selectDefaultSubRoute', () => {
  it('returns the bare base route when there are no conflicts', () => {
    expect(
      selectDefaultSubRoute({
        mergeConflictInfo: makeInfo([]),
        baseMergeRoute: 'merge',
      })
    ).toBe('merge');
  });
});
