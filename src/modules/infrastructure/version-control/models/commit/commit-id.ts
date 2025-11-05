import { type UrlHeads as AutomergeUrlHeads } from '@automerge/automerge-repo/slim';
import deepEqual from 'fast-deep-equal';
import { z } from 'zod';

export const gitCommitHashSchema = z
  .string()
  .regex(/^[0-9a-f]{7,40}$/, 'Invalid git commit hash')
  .brand('GitCommitHash');

export type GitCommitHash = z.infer<typeof gitCommitHashSchema>;

export type CommitId = AutomergeUrlHeads | GitCommitHash;

export const isGitCommitHash = (id: CommitId): id is GitCommitHash =>
  !Array.isArray(id) && gitCommitHashSchema.safeParse(id).success;

export const isAutomergeUrlHeads = (id: CommitId): id is AutomergeUrlHeads =>
  Array.isArray(id);

export const urlEncodeCommitId = (id: CommitId): string => {
  if (isAutomergeUrlHeads(id)) {
    return encodeURLHeads(id);
  }

  return encodeURIComponent(id);
};

export const decodeUrlEncodedCommitId = (
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

export const commitIdsAreSame = (a: CommitId, b: CommitId): boolean => {
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
