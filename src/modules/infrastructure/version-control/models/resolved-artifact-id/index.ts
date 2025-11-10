import {
  type AutomergeUrl,
  isValidAutomergeUrl,
} from '@automerge/automerge-repo/slim';
import { z } from 'zod';

import { type GitBlobRef, gitBlobRefSchema } from './git-blob-ref';

// Automerge URL schema
const automergeUrlSchema = z.custom<AutomergeUrl>(
  (val): val is AutomergeUrl => {
    return typeof val === 'string' && isValidAutomergeUrl(val);
  },
  {
    message: 'Invalid Automerge URL',
  }
);

// Union type for version control IDs
export const resolvedArtifactIdSchema = z.union([
  automergeUrlSchema,
  gitBlobRefSchema,
]);

export type ResolvedArtifactId = z.infer<typeof resolvedArtifactIdSchema>;

export const isGitBlobRef = (id: ResolvedArtifactId): id is GitBlobRef => {
  return typeof id === 'string' && id.startsWith('/blob/');
};

export const isAutomergeUrl = (id: ResolvedArtifactId): id is AutomergeUrl => {
  return typeof id === 'string' && isValidAutomergeUrl(id);
};

export const parseResolvedArtifactId = (input: string) =>
  resolvedArtifactIdSchema.parse(input);

export const isValidResolvedArtifactId = (
  val: unknown
): val is ResolvedArtifactId => {
  return resolvedArtifactIdSchema.safeParse(val).success;
};

export const urlEncodeArtifactId = (id: ResolvedArtifactId) => {
  if (isAutomergeUrl(id)) {
    return id;
  }

  return encodeURIComponent(id);
};

export const decodeUrlEncodedArtifactId = (
  urlEncodedArtifactId: string
): ResolvedArtifactId | null => {
  try {
    const parsedId = parseResolvedArtifactId(
      decodeURIComponent(urlEncodedArtifactId)
    );
    return parsedId;
  } catch (e) {
    console.error('Failed to decode URL heads:', e);
    return null;
  }
};

export { type AutomergeUrl } from '@automerge/automerge-repo/slim';
export { type GitBlobRef } from './git-blob-ref';
export * from './utils';
