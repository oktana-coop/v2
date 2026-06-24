import { z } from 'zod';

import { type GitBlobRef, gitBlobRefSchema } from './git-blob-ref';

// TODO: this id should be opaque. It currently encodes the branch + path (a git
// blob ref) and callers derive the document path by decomposing it directly.
// That git-specific decomposition should be encapsulated (e.g. behind a store)
// so callers can treat the id as an opaque token.
export const resolvedArtifactIdSchema = gitBlobRefSchema;

export type ResolvedArtifactId = z.infer<typeof resolvedArtifactIdSchema>;

export const isGitBlobRef = (id: ResolvedArtifactId): id is GitBlobRef => {
  return typeof id === 'string' && id.startsWith('/blob/');
};

export const parseResolvedArtifactId = (input: string) =>
  resolvedArtifactIdSchema.parse(input);

export const isValidResolvedArtifactId = (
  val: unknown
): val is ResolvedArtifactId => {
  return resolvedArtifactIdSchema.safeParse(val).success;
};

export const urlEncodeArtifactId = (id: ResolvedArtifactId) =>
  encodeURIComponent(id);

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

export { type GitBlobRef } from './git-blob-ref';
export * from './utils';
