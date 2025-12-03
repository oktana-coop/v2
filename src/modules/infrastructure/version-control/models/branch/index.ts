import { z } from 'zod';

// Branch or tag name, inspired by Git
export const BRANCH_TAG_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*[a-zA-Z0-9]$/;

// Ref names must follow these rules (inspired by Git):
// - Cannot start with . or /
// - Cannot end with .lock, . or /
// - Cannot contain .., @{, \, ASCII control characters, ~, ^, :, ?, *, [
// - Can contain / but not consecutive //
// eslint-disable-next-line no-control-regex
const INVALID_REF_CHARS = /[\\~^:?*[\]@{}\x00-\x1f\x7f]|\.\.|\/{2,}|@\{/;

export const isValidBranchOrTagName = (ref: string): boolean => {
  // Check for invalid characters and patterns
  if (INVALID_REF_CHARS.test(ref)) return false;

  // Check if it's a valid branch/tag name
  if (ref.length === 0) return false;
  if (ref.startsWith('.') || ref.startsWith('/')) return false;
  if (ref.endsWith('.') || ref.endsWith('/') || ref.endsWith('.lock'))
    return false;

  // Must contain only valid characters
  return BRANCH_TAG_REGEX.test(ref);
};

export const branchSchema = z
  .string()
  .refine(
    (val): val is Branch => {
      return isValidBranchOrTagName(val);
    },
    {
      message: 'Invalid branch name',
    }
  )
  .brand<'Branch'>();

export type Branch = z.infer<typeof branchSchema>;
