import { type Branch } from '../branch';
import { type Commit } from '../commit';
import {
  isAddAddConflict,
  isContentConflict,
  type MergeConflict,
} from './merge-conflict';

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

export const hasStructuralConflicts = (conflictInfo: MergeConflictInfo) =>
  conflictInfo.conflicts.some(
    (conflict) => !isContentConflict(conflict) && !isAddAddConflict(conflict)
  );
