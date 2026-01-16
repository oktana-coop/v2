import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';
import { GitIndexManager } from 'isomorphic-git/managers';
import path from 'path';

import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import { DEFAULT_AUTHOR_NAME } from '../../constants';
import {
  MergeConflictError,
  NotFoundError,
  RepositoryError,
} from '../../errors';
import {
  type AddAddConflict,
  type Branch,
  type Commit,
  type ContentConflict,
  createGitBlobRef,
  type GitCommitHash,
  type MergeConflict,
  type MergeConflictInfo,
  mergePoles,
  type ModifyDeleteConflict,
  parseGitCommitHash,
} from '../../models';
import { deleteBranch, switchToBranch } from '../branching';
import { IsoGitDeps } from '../types';

export type MergeAndDeleteBranchArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  from: Branch;
  into: Branch;
};

type ConflictCommits = {
  targetCommitId: GitCommitHash;
  sourceCommitId: GitCommitHash;
  commonAncestorCommitId: GitCommitHash;
};

export const mergeAndDeleteBranch = ({
  isoGitFs,
  dir,
  from,
  into,
}: MergeAndDeleteBranchArgs): Effect.Effect<
  Commit['id'],
  RepositoryError | NotFoundError | MergeConflictError,
  never
> => {
  type IsoGitMergeConflictErrorData = {
    filepaths: string[];
    bothModified: string[];
    deleteByUs: string[];
    deleteByTheirs: string[];
  };

  const writeMergeState = ({
    isoGitFs,
    dir,
    sourceBranch,
  }: Omit<IsoGitDeps, 'isoGitHttp'> & {
    sourceBranch: Branch;
  }): Effect.Effect<void, RepositoryError, never> =>
    pipe(
      getCommitForRef({ isoGitFs, dir, ref: sourceBranch }),
      Effect.flatMap((sourceCommitHash) =>
        Effect.tryPromise({
          try: () =>
            isoGitFs.promises.writeFile(
              path.join(dir, '.git', 'MERGE_HEAD'),
              sourceCommitHash + '\n',
              'utf8'
            ),
          catch: mapErrorTo(RepositoryError, 'Error writing MERGE_HEAD'),
        })
      ),
      Effect.tap(() =>
        Effect.tryPromise({
          try: () =>
            isoGitFs.promises.writeFile(
              path.join(dir, '.git', 'MERGE_MSG'),
              `Merge branch ${sourceBranch}.` + '\n',
              'utf8'
            ),
          catch: mapErrorTo(RepositoryError, 'Error writing MERGE_MSG'),
        })
      ),
      Effect.tap(() =>
        Effect.tryPromise({
          try: () =>
            isoGitFs.promises.writeFile(
              path.join(dir, '.git', 'MERGE_MODE'),
              '',
              'utf8'
            ),
          catch: mapErrorTo(RepositoryError, 'Error writing MERGE_MODE'),
        })
      )
    );

  const readMergeConflictsFromErrorData = ({
    errData,
    conflictCommits,
  }: {
    errData: IsoGitMergeConflictErrorData;
    conflictCommits: ConflictCommits;
  }): MergeConflict[] => {
    const deletedInSourceConflicts: ModifyDeleteConflict[] =
      errData.deleteByTheirs.length > 0
        ? errData.deleteByTheirs.map((filepath) => ({
            kind: 'modify/delete',
            // TODO: Parse this properly.
            // Deleted in source; the artifact we want is from target.
            artifactId: createGitBlobRef({
              ref: conflictCommits.targetCommitId,
              path: filepath,
            }),
            path: filepath,
            deletedIn: mergePoles.MERGE_SOURCE,
          }))
        : [];

    const deletedInTargetConflicts: ModifyDeleteConflict[] =
      errData.deleteByUs.length > 0
        ? errData.deleteByUs.map((filepath) => ({
            kind: 'modify/delete',
            // TODO: Parse this properly.
            // Deleted in target; the artifact we want is from source.
            artifactId: createGitBlobRef({
              ref: conflictCommits.sourceCommitId,
              path: filepath,
            }),
            path: filepath,
            deletedIn: mergePoles.MERGE_TARGET,
          }))
        : [];

    const contentConflicts: ContentConflict[] =
      errData.bothModified.length > 0
        ? errData.bothModified.map((filepath) => ({
            kind: 'content',
            // TODO: Parse these properly.
            sourceArtifactId: createGitBlobRef({
              ref: conflictCommits.sourceCommitId,
              path: filepath,
            }),
            targetArtifactId: createGitBlobRef({
              ref: conflictCommits.targetCommitId,
              path: filepath,
            }),
            commonAncestorArtifactId: createGitBlobRef({
              ref: conflictCommits.commonAncestorCommitId,
              path: filepath,
            }),
            path: filepath,
          }))
        : [];

    return [
      ...deletedInSourceConflicts,
      ...deletedInTargetConflicts,
      ...contentConflicts,
    ];
  };

  const IsoGitMergeConflictErrorTag = 'IsoGitMergeConflictError';
  class IsoGitMergeConflictError extends Cause.YieldableError {
    readonly _tag = IsoGitMergeConflictErrorTag;
    readonly data;

    constructor(errData: IsoGitMergeConflictErrorData, message?: string) {
      super(message);
      this.data = errData;
    }
  }

  return pipe(
    switchToBranch({ isoGitFs, dir, branch: into }),
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () =>
          git.merge({
            fs: isoGitFs,
            dir,
            ours: into,
            theirs: from,
            author: {
              name: DEFAULT_AUTHOR_NAME,
            },
            abortOnConflict: false,
          }),
        catch: (err) => {
          if (err instanceof IsoGitErrors.MergeConflictError) {
            return new IsoGitMergeConflictError(err.data);
          }

          return new RepositoryError(
            `Error when trying to merge ${from} into ${into}`
          );
        },
      })
    ),
    Effect.catchTag(IsoGitMergeConflictErrorTag, (err) =>
      pipe(
        writeMergeState({ isoGitFs, dir, sourceBranch: from }),
        Effect.flatMap(() => getConflictCommits({ isoGitFs, dir })),
        Effect.flatMap((conflictCommits) => {
          const mergeConflictInfo: MergeConflictInfo = {
            ...conflictCommits,
            sourceBranch: from,
            targetBranch: into,
            conflicts: readMergeConflictsFromErrorData({
              errData: err.data,
              conflictCommits,
            }),
          };

          return new MergeConflictError(
            `Error when trying to merge ${from} into ${into} due to conflicts.`,
            mergeConflictInfo
          );
        })
      )
    ),
    Effect.flatMap(({ oid }) =>
      pipe(
        fromNullable(
          oid,
          () =>
            // TODO: Revert the whole merge in this case (in a transactional manner).
            new RepositoryError(
              'Could not resolve the new head of the branch after merging.'
            )
        ),
        Effect.flatMap((mergeCommitId) =>
          Effect.try({
            try: () => parseGitCommitHash(mergeCommitId),
            catch: mapErrorTo(RepositoryError, 'Invalid merge commit ID.'),
          })
        )
      )
    ),
    Effect.tap(() => deleteBranch({ isoGitFs, dir, branch: from }))
  );
};

export type IsInMergeConflictStateArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

export const isInMergeConflictState = ({
  isoGitFs,
  dir,
}: IsInMergeConflictStateArgs): Effect.Effect<
  boolean,
  RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        await git.resolveRef({
          fs: isoGitFs,
          dir,
          ref: 'MERGE_HEAD',
        });
        return true;
      },
      catch: mapErrorTo(NotFoundError, 'Merge head not found'),
    }),
    Effect.catchAll(() => Effect.succeed(false))
  );

export type GetMergeConflictInfoArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

const getCommitForRef = ({
  ref,
  isoGitFs,
  dir,
}: Omit<IsoGitDeps, 'isoGitHttp'> & { ref: string }): Effect.Effect<
  GitCommitHash,
  RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.resolveRef({
          fs: isoGitFs,
          dir,
          ref,
        }),
      catch: mapErrorTo(RepositoryError, 'Error in resolving Git ref.'),
    }),
    Effect.flatMap((commitOid) =>
      Effect.try({
        try: () => parseGitCommitHash(commitOid),
        catch: mapErrorTo(
          RepositoryError,
          'Error in resolving Git ref commit id.'
        ),
      })
    )
  );

const getConflictCommits = ({
  isoGitFs,
  dir,
}: Omit<IsoGitDeps, 'isoGitHttp'>): Effect.Effect<
  ConflictCommits,
  RepositoryError,
  never
> =>
  Effect.Do.pipe(
    Effect.bind('targetCommitId', () =>
      getCommitForRef({ ref: 'HEAD', isoGitFs, dir })
    ),
    Effect.bind('sourceCommitId', () =>
      getCommitForRef({ ref: 'MERGE_HEAD', isoGitFs, dir })
    ),
    Effect.bind(
      'commonAncestorCommitId',
      ({ targetCommitId, sourceCommitId }) =>
        pipe(
          Effect.tryPromise({
            try: async () => {
              const result = await git.findMergeBase({
                fs: isoGitFs,
                dir,
                oids: [targetCommitId, sourceCommitId],
              });

              // findMergeBase returns any[]; narrow it to string[].
              if (
                !Array.isArray(result) ||
                !result.every((x) => typeof x === 'string')
              ) {
                throw new Error('Unexpected return value from findMergeBase');
              }

              if (result.length === 0) {
                throw new Error(
                  'No merge base (common ancestor between source and target commit) found'
                );
              }

              if (result.length > 1) {
                console.warn(
                  'Multiple merge bases (common ancestors between source and target commits) found, using first'
                );
              }

              return result[0];
            },
            catch: mapErrorTo(
              RepositoryError,
              'Error in finding common ancestor between source and target commits.'
            ),
          }),
          Effect.flatMap((mergeBaseInput) =>
            Effect.try({
              try: () => parseGitCommitHash(mergeBaseInput),
              catch: mapErrorTo(
                RepositoryError,
                'Error in resolving Git repo HEAD commit id.'
              ),
            })
          )
        )
    )
  );

const readMergeConflictsFromGitIndex = ({
  isoGitFs,
  dir,
  conflictCommits,
}: Omit<IsoGitDeps, 'isoGitHttp'> & {
  conflictCommits: ConflictCommits;
}): Effect.Effect<MergeConflict[], RepositoryError, never> => {
  type UnmergedPathInfo = {
    path: string;
    stages: Record<string, string>;
  };

  const mergeConflictFromUnmergedPathInfo = ({
    unmergedPathInfo,
  }: {
    unmergedPathInfo: UnmergedPathInfo;
  }): Effect.Effect<MergeConflict, RepositoryError, never> => {
    if (
      unmergedPathInfo.stages['1'] &&
      unmergedPathInfo.stages['2'] &&
      unmergedPathInfo.stages['3']
    ) {
      const conflict: ContentConflict = {
        kind: 'content',
        // TODO: Parse these properly.
        sourceArtifactId: createGitBlobRef({
          ref: conflictCommits.sourceCommitId,
          path: unmergedPathInfo.path,
        }),
        targetArtifactId: createGitBlobRef({
          ref: conflictCommits.targetCommitId,
          path: unmergedPathInfo.path,
        }),
        commonAncestorArtifactId: createGitBlobRef({
          ref: conflictCommits.commonAncestorCommitId,
          path: unmergedPathInfo.path,
        }),
        path: unmergedPathInfo.path,
      };

      return Effect.succeed(conflict);
    }

    if (
      !unmergedPathInfo.stages['1'] &&
      unmergedPathInfo.stages['2'] &&
      unmergedPathInfo.stages['3']
    ) {
      const conflict: AddAddConflict = {
        kind: 'add/add',
        // TODO: Parse this properly.
        sourceArtifactId: createGitBlobRef({
          ref: conflictCommits.sourceCommitId,
          path: unmergedPathInfo.path,
        }),
        targetArtifactId: createGitBlobRef({
          ref: conflictCommits.targetCommitId,
          path: unmergedPathInfo.path,
        }),
        path: unmergedPathInfo.path,
      };

      return Effect.succeed(conflict);
    }

    if (
      unmergedPathInfo.stages['1'] &&
      unmergedPathInfo.stages['2'] &&
      !unmergedPathInfo.stages['3']
    ) {
      const conflict: ModifyDeleteConflict = {
        kind: 'modify/delete',
        // TODO: Parse this properly.
        // Deleted in source; the artifact we want is from target.
        artifactId: createGitBlobRef({
          ref: conflictCommits.targetCommitId,
          path: unmergedPathInfo.path,
        }),
        path: unmergedPathInfo.path,
        deletedIn: mergePoles.MERGE_SOURCE,
      };

      return Effect.succeed(conflict);
    }

    if (
      unmergedPathInfo.stages['1'] &&
      unmergedPathInfo.stages['3'] &&
      !unmergedPathInfo.stages['2']
    ) {
      const conflict: ModifyDeleteConflict = {
        kind: 'modify/delete',
        // TODO: Parse this properly.
        // Deleted in target; the artifact we want is from source.
        artifactId: createGitBlobRef({
          ref: conflictCommits.sourceCommitId,
          path: unmergedPathInfo.path,
        }),
        path: unmergedPathInfo.path,
        deletedIn: mergePoles.MERGE_TARGET,
      };

      return Effect.succeed(conflict);
    }

    return Effect.fail(
      new RepositoryError(
        `Could not process merge conflict for path ${unmergedPathInfo.path}`
      )
    );
  };

  return pipe(
    Effect.tryPromise({
      try: async () => {
        const unmergedEntries: UnmergedPathInfo[] =
          await GitIndexManager.acquire(
            {
              fs: {
                ...isoGitFs.promises,
                read: isoGitFs.promises.readFile,
              },
              gitdir: path.join(dir, '.git'),
              cache: {},
              allowUnmerged: true,
            },
            async (index) =>
              index.unmergedPaths.map((path) => {
                const entry = index.entriesMap.get(path) as {
                  stages: {
                    oid: string;
                    flags: {
                      stage: number;
                    };
                  }[];
                };

                const unmergedPathInfo: UnmergedPathInfo = {
                  path,
                  stages: entry.stages.filter(Boolean).reduce(
                    (stagesAcc, current) => ({
                      ...stagesAcc,
                      [current.flags.stage]: current.oid,
                    }),
                    {}
                  ),
                };

                return unmergedPathInfo;
              })
          );

        return unmergedEntries;
      },
      catch: mapErrorTo(RepositoryError, 'Error in listing Git index files.'),
    }),
    Effect.flatMap((unmergedPathsInfo) =>
      Effect.forEach(unmergedPathsInfo, (unmergedPathInfo) =>
        mergeConflictFromUnmergedPathInfo({ unmergedPathInfo })
      )
    )
  );
};

export const getMergeConflictInfo = ({
  isoGitFs,
  dir,
}: GetMergeConflictInfoArgs): Effect.Effect<
  MergeConflictInfo | null,
  RepositoryError,
  never
> =>
  pipe(
    isInMergeConflictState({ dir, isoGitFs }),
    Effect.flatMap((inMergeConflictState) =>
      inMergeConflictState
        ? pipe(
            getConflictCommits({ dir, isoGitFs }),
            Effect.flatMap((conflictCommits) =>
              pipe(
                readMergeConflictsFromGitIndex({
                  isoGitFs,
                  dir,
                  conflictCommits,
                }),
                Effect.map((conflicts) => ({
                  ...conflictCommits,
                  conflicts,
                }))
              )
            )
          )
        : Effect.succeed(null)
    )
  );

export type AbortMergeArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

export const abortMerge = ({
  isoGitFs,
  dir,
}: AbortMergeArgs): Effect.Effect<void, RepositoryError, never> => {
  const clearMergeState = ({
    isoGitFs,
    dir,
  }: Omit<IsoGitDeps, 'isoGitHttp'>): Effect.Effect<
    void,
    RepositoryError,
    never
  > =>
    pipe(
      Effect.tryPromise({
        try: () =>
          isoGitFs.promises.unlink(path.join(dir, '.git', 'MERGE_HEAD')),
        catch: mapErrorTo(RepositoryError, 'Error deleting MERGE_HEAD'),
      }),
      Effect.tap(() =>
        Effect.tryPromise({
          try: () =>
            isoGitFs.promises.unlink(path.join(dir, '.git', 'MERGE_MSG')),
          catch: mapErrorTo(RepositoryError, 'Error deleting MERGE_MSG'),
        })
      ),
      Effect.tap(() =>
        Effect.tryPromise({
          try: () =>
            isoGitFs.promises.unlink(path.join(dir, '.git', 'MERGE_MODE')),
          catch: mapErrorTo(RepositoryError, 'Error deleting MERGE_MODE'),
        })
      )
    );

  return pipe(
    Effect.tryPromise({
      try: () =>
        git.abortMerge({
          fs: isoGitFs,
          dir,
        }),
      catch: mapErrorTo(RepositoryError, 'Error in aborting merge.'),
    }),
    Effect.tap(() => clearMergeState({ isoGitFs, dir }))
  );
};
