import { z } from 'zod';

import { isValidBranchOrTagName } from '../branch';

// Git ref validation patterns
export const GIT_SHA_REGEX = /^[0-9a-f]{4,40}$/; // Commit SHA (short or full)

const isValidGitSha = (ref: string): boolean => GIT_SHA_REGEX.test(ref);

const isValidGitRef = (ref: string): boolean =>
  isValidGitSha(ref) || isValidBranchOrTagName(ref);

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
