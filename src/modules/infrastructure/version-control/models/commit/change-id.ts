import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { ValidationError } from '../../errors';

export const UNCOMMITTED_CHANGE_ID = 'uncommitted';

export const gitCommitHashSchema = z
  .string()
  .regex(/^[0-9a-f]{7,40}$/, 'Invalid git commit hash')
  .brand('GitCommitHash');

export type GitCommitHash = z.infer<typeof gitCommitHashSchema>;

export const parseGitCommitHash = (input: string): GitCommitHash =>
  gitCommitHashSchema.parse(input);

export const parseGitCommitHashEffect = (
  input: string
): Effect.Effect<GitCommitHash, ValidationError, never> =>
  Effect.try({
    try: () => parseGitCommitHash(input),
    catch: () => new ValidationError(`Invalid git commit hash: ${input}`),
  });

export const isGitCommitHash = (id: ChangeId): id is GitCommitHash =>
  !isUncommittedChangeId(id) && gitCommitHashSchema.safeParse(id).success;

export const uncommittedChangeIdSchema = z.literal(UNCOMMITTED_CHANGE_ID);

export type UncommittedChangeId = z.infer<typeof uncommittedChangeIdSchema>;

export const commitIdSchema = gitCommitHashSchema;

export const parseCommitId = (input: string): CommitId =>
  commitIdSchema.parse(input);

export const parseCommitIdEffect = (
  input: string
): Effect.Effect<CommitId, ValidationError, never> =>
  Effect.try({
    try: () => parseCommitId(input),
    catch: () => new ValidationError(`Invalid commit id: ${input}`),
  });

export type CommitId = z.infer<typeof commitIdSchema>;

export const getShortenedCommitId = (id: CommitId) => id.slice(0, 7);

export const changeIdSchema = z.union([
  commitIdSchema,
  uncommittedChangeIdSchema,
]);

export type ChangeId = z.infer<typeof changeIdSchema>;

export const parseChangeId = (input: string): ChangeId =>
  changeIdSchema.parse(input);

export const parseChangeIdEffect = (
  input: string
): Effect.Effect<ChangeId, ValidationError, never> =>
  Effect.try({
    try: () => parseChangeId(input),
    catch: () => new ValidationError(`Invalid change id: ${input}`),
  });

export const urlEncodeChangeId = (id: ChangeId): string =>
  encodeURIComponent(id);

export const isUncommittedChangeId = (
  id: ChangeId
): id is UncommittedChangeId => id === UNCOMMITTED_CHANGE_ID;

export const decodeUrlEncodedChangeId = (
  urlEncodedCommitId: string
): ChangeId => parseChangeId(decodeURIComponent(urlEncodedCommitId));

export const decodeUrlEncodedCommitId = (
  urlEncodedCommitId: string
): CommitId => parseCommitId(decodeURIComponent(urlEncodedCommitId));

export const changeIdsAreSame = (a: ChangeId, b: ChangeId): boolean => {
  if (isUncommittedChangeId(a) && isUncommittedChangeId(b)) {
    return true;
  }

  if (isGitCommitHash(a) && isGitCommitHash(b)) {
    return a === b;
  }

  return false;
};
