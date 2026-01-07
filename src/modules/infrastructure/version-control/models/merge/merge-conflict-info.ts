import { type Commit } from '../commit';
import { type MergeConflict } from './merge-conflict';

export type MergeConflictInfo = {
  // Aka "ours" in Git.
  targetCommitId: Commit['id'];
  // Aka "their" in Git.
  sourceCommitId: Commit['id'];
  // Aka "base" in Git.
  commonAncestorCommitId: Commit['id'];
  conflicts: MergeConflict[];
};
