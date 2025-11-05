import {
  GIT_SHA_REGEX,
  type GitBlobRef,
  gitBlobRefSchema,
} from './git-blob-ref';

export const decomposeGitBlobRef = (
  ref: GitBlobRef
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
