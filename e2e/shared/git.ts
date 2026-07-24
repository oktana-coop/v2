import { execFileSync } from 'child_process';

// Drives the real git binary rather than the app's isomorphic-git, so specs can
// assert on repository state independently of the code under test.
const git = (args: string[], cwd: string): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

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
  // Signing is enabled globally on some machines, which would fail the commit.
  git(['-c', 'commit.gpgsign=false', 'commit', '-m', message], repoDir);
};
