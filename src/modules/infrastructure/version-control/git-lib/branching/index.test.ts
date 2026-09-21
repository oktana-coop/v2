import * as Effect from 'effect/Effect';
import fs from 'fs';
import git, { type PromiseFsClient } from 'isomorphic-git';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BranchSwitchConflictError } from '../../errors';
import { type Branch } from '../../models';
import { switchToBranch } from './index';

const isoGitFs = fs as unknown as PromiseFsClient;
const author = { name: 'Someone', email: 'someone@example.com' };

// A repository on main, with a branch `feature` that rewrites `differs.md`
// and adds `feature-only.md`; `shared.md` is the same on both.
const createRepository = async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-switch-'));
  const write = (name: string, content: string) =>
    fs.writeFileSync(path.join(dir, name), content);
  const read = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8');
  const exists = (name: string) => fs.existsSync(path.join(dir, name));
  const stage = (name: string) => git.add({ fs, dir, filepath: name });
  const commit = async (message: string) => {
    await git.add({ fs, dir, filepath: '.' });
    await git.commit({ fs, dir, message, author });
  };
  const currentBranch = () => git.currentBranch({ fs, dir });
  const status = (name: string) => git.status({ fs, dir, filepath: name });

  await git.init({ fs, dir, defaultBranch: 'main' });
  write('shared.md', 'shared');
  write('differs.md', 'on main');
  await commit('base');
  await git.branch({ fs, dir, ref: 'feature', checkout: true });
  write('differs.md', 'on feature');
  write('feature-only.md', 'only here');
  await commit('feature');
  await git.checkout({ fs, dir, ref: 'main' });

  return { dir, write, read, exists, stage, currentBranch, status };
};

type Repository = Awaited<ReturnType<typeof createRepository>>;

describe('switchToBranch', () => {
  let repo: Repository;

  beforeEach(async () => {
    repo = await createRepository();
  });

  afterEach(() => {
    fs.rmSync(repo.dir, { recursive: true, force: true });
  });

  const switchTo = (branch: string) =>
    Effect.runPromise(
      switchToBranch({ isoGitFs, dir: repo.dir, branch: branch as Branch })
    );

  it('checks out what differs and leaves the rest alone', async () => {
    await switchTo('feature');

    expect(await repo.currentBranch()).toBe('feature');
    expect(repo.read('differs.md')).toBe('on feature');
    expect(repo.exists('feature-only.md')).toBe(true);
  });

  it('brings an edit to a file both branches share along', async () => {
    repo.write('shared.md', 'edited here');

    await switchTo('feature');

    expect(await repo.currentBranch()).toBe('feature');
    expect(repo.read('shared.md')).toBe('edited here');
    expect(await repo.status('shared.md')).toBe('*modified');
  });

  it('refuses when an edited file differs between the branches', async () => {
    repo.write('differs.md', 'edited here');

    const failure = await Effect.runPromise(
      Effect.flip(
        switchToBranch({
          isoGitFs,
          dir: repo.dir,
          branch: 'feature' as Branch,
        })
      )
    );

    expect(failure).toBeInstanceOf(BranchSwitchConflictError);
    expect((failure as BranchSwitchConflictError).data.filepaths).toEqual([
      'differs.md',
    ]);
    expect(await repo.currentBranch()).toBe('main');
    expect(repo.read('differs.md')).toBe('edited here');
  });

  // isomorphic-git reverts a staged edit and deletes a staged new file where
  // git keeps both; decided 2026-09-21 to live with it rather than decide the
  // switch here. TODO: unskip once isomorphic-git switches as git does.
  it.skip('keeps a staged edit to a shared file staged', async () => {
    repo.write('shared.md', 'edited here');
    await repo.stage('shared.md');

    await switchTo('feature');

    expect(repo.read('shared.md')).toBe('edited here');
    expect(await repo.status('shared.md')).toBe('modified');
  });

  it.skip('keeps a staged new file', async () => {
    repo.write('new.md', 'new here');
    await repo.stage('new.md');

    await switchTo('feature');

    expect(repo.read('new.md')).toBe('new here');
    expect(await repo.status('new.md')).toBe('added');
  });

  it('refuses when an untracked file would be overwritten', async () => {
    repo.write('feature-only.md', 'mine, untracked');

    const failure = await Effect.runPromise(
      Effect.flip(
        switchToBranch({
          isoGitFs,
          dir: repo.dir,
          branch: 'feature' as Branch,
        })
      )
    );

    expect(failure).toBeInstanceOf(BranchSwitchConflictError);
    expect(await repo.currentBranch()).toBe('main');
    expect(repo.read('feature-only.md')).toBe('mine, untracked');
  });

  it('moves to a branch that differs in nothing', async () => {
    await git.branch({ fs, dir: repo.dir, ref: 'same' });
    repo.write('shared.md', 'edited here');

    await switchTo('same');

    expect(await repo.currentBranch()).toBe('same');
    expect(repo.read('shared.md')).toBe('edited here');
  });
});
