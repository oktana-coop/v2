import { z } from 'zod';

import { isValidBranchOrTagName } from '../branch';
import {
  type ResolvedArtifactId,
  resolvedArtifactIdSchema,
} from '../resolved-artifact-id';

export const GIT_SHA_REGEX = /^[0-9a-f]{4,40}$/; // Commit SHA (short or full)

const isValidGitSha = (ref: string): boolean => GIT_SHA_REGEX.test(ref);

const isValidGitRefComponent = (ref: string): boolean =>
  isValidGitSha(ref) || isValidBranchOrTagName(ref);

// Git blob reference schema
// Format: /blob/{ref}/{path}
// ref can be: commit SHA (4-40 hex chars), branch name, or tag
export const gitBlobRefSchema = resolvedArtifactIdSchema
  .refine(
    (val) => {
      // Must start with /blob/
      if (!val.startsWith('/blob/')) return false;

      // Split into parts: ['', 'blob', ref, ...pathParts]
      const parts = val.split('/');

      // Must have at least /blob/ref/path (4 parts after split)
      if (parts.length < 4) return false;

      const ref = parts[2];
      const path = parts.slice(3).join('/');

      // Validate ref
      if (!ref || !isValidGitRefComponent(ref)) return false;

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

export const isGitBlobRef = (id: ResolvedArtifactId): id is GitBlobRef => {
  return typeof id === 'string' && id.startsWith('/blob/');
};

export const isValidGitBlobRef = (val: unknown): val is GitBlobRef =>
  gitBlobRefSchema.safeParse(val).success;

export const createGitBlobRef = ({
  ref,
  path,
}: {
  ref: string;
  path: string;
}): GitBlobRef => {
  // Ensure path doesn't start with /
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const blobRef = `/blob/${ref}/${cleanPath}`;

  // Validate and return
  const result = gitBlobRefSchema.safeParse(blobRef);
  if (!result.success) {
    throw new Error(`Invalid Git blob reference: ${result.error.message}`);
  }
  return result.data;
};

// Directory (tree) reference: /tree/{ref}/{path}.
// ref can be: commit SHA (4-40 hex chars), branch name, or tag
export const gitTreeRefSchema = resolvedArtifactIdSchema
  .refine((val) => {
    if (!val.startsWith('/tree/')) return false;
    const parts = val.split('/');
    if (parts.length < 4) return false;
    const ref = parts[2];
    const path = parts.slice(3).join('/');
    return Boolean(ref && isValidGitRefComponent(ref) && path);
  })
  .brand<'GitTreeRef'>();

export type GitTreeRef = z.infer<typeof gitTreeRefSchema>;

export const isGitTreeRef = (id: ResolvedArtifactId): id is GitTreeRef =>
  typeof id === 'string' && id.startsWith('/tree/');

// A git artifact id, either a blob (document/asset) or tree (directory) ref.
export type GitRef = GitBlobRef | GitTreeRef;

export const isGitRef = (id: ResolvedArtifactId): id is GitRef =>
  isGitBlobRef(id) || isGitTreeRef(id);

// Both /blob/ and /tree/ refs share the {kind}/{ref}/{path} layout, so a single
// decomposition works for either.
export const decomposeGitRef = (
  ref: GitRef
): {
  ref: string;
  path: string;
  refType: 'commit' | 'branch-or-tag';
} => {
  const parts = ref.split('/');
  const gitRef = parts[2];

  return {
    ref: gitRef,
    path: parts.slice(3).join('/'),
    refType: GIT_SHA_REGEX.test(gitRef) ? 'commit' : 'branch-or-tag',
  };
};

export const createGitTreeRef = ({
  ref,
  path,
}: {
  ref: string;
  path: string;
}): GitTreeRef => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const treeRef = `/tree/${ref}/${cleanPath}`;

  const result = gitTreeRefSchema.safeParse(treeRef);
  if (!result.success) {
    throw new Error(`Invalid Git tree reference: ${result.error.message}`);
  }
  return result.data;
};
