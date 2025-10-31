import {
  type AutomergeUrl,
  isValidAutomergeUrl,
} from '@automerge/automerge-repo/slim';
import { z } from 'zod';

// Git ref validation patterns
export const GIT_SHA_REGEX = /^[0-9a-f]{4,40}$/; // Commit SHA (short or full)
const GIT_BRANCH_TAG_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*[a-zA-Z0-9]$/; // Branch or tag name

// Git ref names must follow these rules:
// - Cannot start with . or /
// - Cannot end with .lock, . or /
// - Cannot contain .., @{, \, ASCII control characters, ~, ^, :, ?, *, [
// - Can contain / but not consecutive //
// eslint-disable-next-line no-control-regex
const INVALID_REF_CHARS = /[\\~^:?*[\]@{}\x00-\x1f\x7f]|\.\.|\/{2,}|@\{/;

const isValidGitRef = (ref: string): boolean => {
  // Check for invalid characters and patterns
  if (INVALID_REF_CHARS.test(ref)) return false;

  // Check if it's a SHA (most permissive)
  if (GIT_SHA_REGEX.test(ref)) return true;

  // Check if it's a valid branch/tag name
  if (ref.length === 0) return false;
  if (ref.startsWith('.') || ref.startsWith('/')) return false;
  if (ref.endsWith('.') || ref.endsWith('/') || ref.endsWith('.lock'))
    return false;

  // Must contain only valid characters
  return GIT_BRANCH_TAG_REGEX.test(ref);
};

// Git blob reference schema
// Format: /blob/{ref}/{path}
// ref can be: commit SHA (4-40 hex chars), branch name, or tag
export const gitBlobRefSchema = z
  .string()
  .refine(
    (val): val is GitBlobRef => {
      // Must start with /blob/
      if (!val.startsWith('/blob/')) return false;

      // Split into parts: ['', 'blob', ref, ...pathParts]
      const parts = val.split('/');

      // Must have at least /blob/ref/path (4 parts after split)
      if (parts.length < 4) return false;

      const ref = parts[2];
      const path = parts.slice(3).join('/');

      // Validate ref
      if (!ref || !isValidGitRef(ref)) return false;

      // Validate path is not empty
      if (!path) return false;

      return true;
    },
    {
      message:
        'Invalid Git blob reference. Expected format: /blob/{ref}/{path} where ref is a valid commit SHA, branch, or tag name',
    }
  )
  .brand<'GitBlobRef'>();

export type GitBlobRef = z.infer<typeof gitBlobRefSchema>;

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

export const isValidResolvedArtifactId = (
  val: unknown
): val is ResolvedArtifactId => {
  return resolvedArtifactIdSchema.safeParse(val).success;
};

export { type AutomergeUrl } from '@automerge/automerge-repo/slim';
