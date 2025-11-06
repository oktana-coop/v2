import { type UrlHeads as AutomergeUrlHeads } from '@automerge/automerge-repo/slim';
import deepEqual from 'fast-deep-equal';
import { z } from 'zod';

export const UNCOMMITTED_CHANGE_ID = 'uncommitted';

export const gitCommitHashSchema = z
  .string()
  .regex(/^[0-9a-f]{7,40}$/, 'Invalid git commit hash')
  .brand('GitCommitHash');

export type GitCommitHash = z.infer<typeof gitCommitHashSchema>;

export const uncommittedChangeIdSchema = z.literal(UNCOMMITTED_CHANGE_ID);

export type UncommittedChangeId = z.infer<typeof uncommittedChangeIdSchema>;

export type CommitId = AutomergeUrlHeads | GitCommitHash;

export type ChangeId = CommitId | UncommittedChangeId;

export const parseGitCommitHash = (input: string): GitCommitHash =>
  gitCommitHashSchema.parse(input);

export const isGitCommitHash = (id: ChangeId): id is GitCommitHash =>
  !Array.isArray(id) &&
  !isUncommittedChangeId(id) &&
  gitCommitHashSchema.safeParse(id).success;

export const isAutomergeUrlHeads = (id: ChangeId): id is AutomergeUrlHeads =>
  Array.isArray(id);

export const urlEncodeChangeId = (id: ChangeId): string => {
  if (isAutomergeUrlHeads(id)) {
    return encodeURLHeads(id);
  }

  return encodeURIComponent(id);
};

export const isUncommittedChangeId = (
  id: ChangeId
): id is UncommittedChangeId => id === UNCOMMITTED_CHANGE_ID;

export const decodeUrlEncodedChangeId = (
  urlEncodedCommitId: string
): CommitId | null => {
  try {
    const parsedHeads = JSON.parse(decodeURIComponent(urlEncodedCommitId));
    return parsedHeads;
  } catch (e) {
    console.error('Failed to decode URL heads:', e);
    return null;
  }
};

export const encodeURLHeads = (heads: AutomergeUrlHeads): string =>
  encodeURIComponent(JSON.stringify(heads));

export const changeIdsAreSame = (a: ChangeId, b: ChangeId): boolean => {
  if (isUncommittedChangeId(a) && isUncommittedChangeId(b)) {
    return true;
  }

  if (isGitCommitHash(a) && isGitCommitHash(b)) {
    return a === b;
  }

  if (isAutomergeUrlHeads(a) && isAutomergeUrlHeads(b)) {
    return headsAreSame(a, b);
  }

  return false;
};

export const headsAreSame = (a: AutomergeUrlHeads, b: AutomergeUrlHeads) => {
  return deepEqual(a, b);
};
