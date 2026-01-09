import { type Branch } from '../branch';
import { type Commit } from '../commit';
import { type MergeConflict } from './merge-conflict';

export type MergeConflictInfo = {
  // Aka "ours" in Git.
  targetCommitId: Commit['id'];
  targetBranch?: Branch;
  // Aka "their" in Git.
  sourceCommitId: Commit['id'];
  sourceBranch?: Branch;
  // Aka "base" in Git.
  commonAncestorCommitId: Commit['id'];
  conflicts: MergeConflict[];
};
