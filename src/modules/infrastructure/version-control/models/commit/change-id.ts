import { type UrlHeads as AutomergeUrlHeads } from '@automerge/automerge-repo/slim';
import deepEqual from 'fast-deep-equal';
import { z } from 'zod';

export const UNCOMMITTED_CHANGE_ID = 'uncommitted';

export const gitCommitHashSchema = z
  .string()
  .regex(/^[0-9a-f]{7,40}$/, 'Invalid git commit hash')
  .brand('GitCommitHash');

export type GitCommitHash = z.infer<typeof gitCommitHashSchema>;

export const parseGitCommitHash = (input: string): GitCommitHash =>
  gitCommitHashSchema.parse(input);

export const isGitCommitHash = (id: ChangeId): id is GitCommitHash =>
  !Array.isArray(id) &&
  !isUncommittedChangeId(id) &&
  gitCommitHashSchema.safeParse(id).success;

export const uncommittedChangeIdSchema = z.literal(UNCOMMITTED_CHANGE_ID);

export type UncommittedChangeId = z.infer<typeof uncommittedChangeIdSchema>;

export const automergeUrlHeadsSchema = z
  .array(z.string())
  .transform((val) => val as AutomergeUrlHeads);

export const parseAutomergeUrlHeads = (input: string[]): AutomergeUrlHeads =>
  automergeUrlHeadsSchema.parse(input);

export const isAutomergeUrlHeads = (id: ChangeId): id is AutomergeUrlHeads =>
  Array.isArray(id);

export const commitIdSchema = z.union([
  gitCommitHashSchema,
  automergeUrlHeadsSchema,
]);

export const parseCommitId = (input: string | string[]): CommitId =>
  commitIdSchema.parse(input);

export type CommitId = z.infer<typeof commitIdSchema>;

export const changeIdSchema = z.union([
  commitIdSchema,
  uncommittedChangeIdSchema,
]);

export type ChangeId = z.infer<typeof changeIdSchema>;

export const parseChangeId = (input: string | string[]): ChangeId =>
  changeIdSchema.parse(input);

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
): ChangeId => {
  const decodedParam = decodeURIComponent(urlEncodedCommitId);

  try {
    const parsedHeads = JSON.parse(decodedParam);

    if (Array.isArray(parsedHeads)) {
      return parseAutomergeUrlHeads(parsedHeads);
    }
  } catch {
    // Could not parse the decoded params as JSON, try to parse it as a generic change ID.
    return parseChangeId(decodedParam);
  }

  // Could not parse the decoded params as JSON, try to parse it as a generic change ID.
  return parseChangeId(decodedParam);
};

export const decodeUrlEncodedCommitId = (
  urlEncodedCommitId: string
): CommitId => {
  const decodedParam = decodeURIComponent(urlEncodedCommitId);

  try {
    const parsedHeads = JSON.parse(decodedParam);

    if (Array.isArray(parsedHeads)) {
      return parseAutomergeUrlHeads(parsedHeads);
    }
  } catch {
    // Could not parse the decoded params as JSON, try to parse it as a generic change ID.
    return parseCommitId(decodedParam);
  }

  // Could not parse the decoded params as JSON, try to parse it as a generic change ID.
  return parseCommitId(decodedParam);
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
