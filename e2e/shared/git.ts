import { execFileSync } from 'child_process';

// Drives the real git binary rather than the app's isomorphic-git, so specs can
// assert on repository state independently of the code under test.
const git = (args: string[], cwd: string): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const toLines = (output: string): string[] =>
  output.split(/\r?\n/).filter(Boolean);

// Empty while the folder is not a repository yet, or has no commits yet, so
// this is safe to poll with as the app sets a newly opened folder up.
export const commitMessages = ({ repoDir }: { repoDir: string }): string[] => {
  try {
    return toLines(git(['log', '--format=%s'], repoDir));
  } catch {
    return [];
  }
};

export const trackedFiles = ({ repoDir }: { repoDir: string }): string[] =>
  toLines(git(['ls-tree', '-r', '--name-only', 'HEAD'], repoDir));

export const lastCommitAuthor = ({ repoDir }: { repoDir: string }): string =>
  git(['log', '-1', '--format=%an <%ae>'], repoDir);

export const hasCleanWorkingTree = ({
  repoDir,
}: {
  repoDir: string;
}): boolean => git(['status', '--porcelain'], repoDir) === '';

export const initRepositoryWithCommit = ({
  repoDir,
  message,
}: {
  repoDir: string;
  message: string;
}): void => {
  git(['init', '--initial-branch=main'], repoDir);
  git(['config', 'user.name', 'Someone'], repoDir);
  git(['config', 'user.email', 'someone@example.com'], repoDir);
  git(['add', '.'], repoDir);
  // Commit signing from a global config would prompt or fail here.
  git(['-c', 'commit.gpgsign=false', 'commit', '-m', message], repoDir);
};
