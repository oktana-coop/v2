import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { Errors as IsoGitErrors } from 'isomorphic-git';

import { mapErrorTo } from '../../../../../utils/errors';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  type ChangedDocument,
  documentChangeTypes,
  type GitCommitHash,
} from '../../models';
import { IsoGitDeps } from '../types';

export type GetChangedFilesForCommitArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  commitId: GitCommitHash;
};

type TreeEntry = {
  path: string;
  oid: string;
};

const getFilesAtRef = (
  isoGitFs: IsoGitDeps['isoGitFs'],
  dir: string,
  ref: string
): Effect.Effect<TreeEntry[], RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      git.walk({
        fs: isoGitFs,
        dir,
        trees: [git.TREE({ ref })],
        // `map` is called for every entry in the tree (root dir, subdirs, files,
        // submodules). Returning `undefined` excludes that entry from the results.
        map: async (filepath, [entry]) => {
          // Skip the root tree entry (filepath is "." for the repo root)
          if (filepath === '.') return undefined;
          if (!entry) return undefined;

          // Only include files (blobs), skip directories and submodules
          const type = await entry.type();
          if (type !== 'blob') return undefined;

          const oid = await entry.oid();

          const treeEntry: TreeEntry = { path: filepath, oid };
          return treeEntry;
        },
      }),
    catch: mapErrorTo(RepositoryError, 'Error walking git tree'),
  });

type TreeEntryMap = Map<string, string>;

const toTreeEntryMap = (entries: TreeEntry[]): TreeEntryMap =>
  new Map(entries.map((e) => [e.path, e.oid]));

const classifyEntries = (
  parentMap: TreeEntryMap,
  currentMap: TreeEntryMap
): {
  added: TreeEntry[];
  deleted: TreeEntry[];
  modified: TreeEntry[];
} => ({
  added: Array.from(currentMap)
    .filter(([path]) => !parentMap.has(path))
    .map(([path, oid]) => ({ path, oid })),
  deleted: Array.from(parentMap)
    .filter(([path]) => !currentMap.has(path))
    .map(([path, oid]) => ({ path, oid })),
  modified: Array.from(currentMap)
    .filter(([path, oid]) => {
      const parentOid = parentMap.get(path);
      return parentOid !== undefined && parentOid !== oid;
    })
    .map(([path, oid]) => ({ path, oid })),
});

/**
 * Match added/deleted pairs with the same oid (content hash) as renames.
 * Unmatched entries are returned as plain adds/deletes.
 */
const detectRenames = (
  added: TreeEntry[],
  deleted: TreeEntry[]
): ChangedDocument[] => {
  const deletedByOid = new Map(deleted.map((e) => [e.oid, e.path]));

  const { renamed, unmatchedAdded, renamedOids } = added.reduce<{
    renamed: ChangedDocument[];
    unmatchedAdded: TreeEntry[];
    renamedOids: Set<string>;
  }>(
    (acc, entry) => {
      const previousPath = deletedByOid.get(entry.oid);
      if (previousPath && !acc.renamedOids.has(entry.oid)) {
        return {
          renamed: [
            ...acc.renamed,
            {
              path: entry.path,
              changeType: documentChangeTypes.RENAMED,
              previousPath,
            },
          ],
          unmatchedAdded: acc.unmatchedAdded,
          renamedOids: new Set([...acc.renamedOids, entry.oid]),
        };
      }
      return { ...acc, unmatchedAdded: [...acc.unmatchedAdded, entry] };
    },
    { renamed: [], unmatchedAdded: [], renamedOids: new Set() }
  );

  const unmatchedDeleted: ChangedDocument[] = deleted
    .filter((e) => !renamedOids.has(e.oid))
    .map((e) => ({ path: e.path, changeType: documentChangeTypes.DELETED }));

  const remainingAdded: ChangedDocument[] = unmatchedAdded.map((e) => ({
    path: e.path,
    changeType: documentChangeTypes.ADDED,
  }));

  return [...renamed, ...remainingAdded, ...unmatchedDeleted];
};

const mapEntriesToAddedFiles = (entries: TreeEntry[]): ChangedDocument[] =>
  entries.map((entry) => ({
    path: entry.path,
    changeType: documentChangeTypes.ADDED,
  }));

const diffTrees = (
  parentEntries: TreeEntry[],
  currentEntries: TreeEntry[]
): ChangedDocument[] => {
  const parentMap = toTreeEntryMap(parentEntries);
  const currentMap = toTreeEntryMap(currentEntries);
  const { added, deleted, modified } = classifyEntries(parentMap, currentMap);

  const modifiedDocuments: ChangedDocument[] = modified.map((e) => ({
    path: e.path,
    changeType: documentChangeTypes.MODIFIED,
  }));

  return [...modifiedDocuments, ...detectRenames(added, deleted)];
};

export const getChangedFilesForCommit = ({
  isoGitFs,
  dir,
  commitId,
}: GetChangedFilesForCommitArgs): Effect.Effect<
  ChangedDocument[],
  RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () => git.readCommit({ fs: isoGitFs, dir, oid: commitId }),
      catch: mapErrorTo(RepositoryError, 'Error reading commit'),
    }),
    Effect.flatMap((commitResult) => {
      const parentOids = commitResult.commit.parent;

      if (parentOids.length === 0) {
        return pipe(
          getFilesAtRef(isoGitFs, dir, commitId),
          Effect.map(mapEntriesToAddedFiles)
        );
      }

      return pipe(
        Effect.all([
          getFilesAtRef(isoGitFs, dir, parentOids[0]),
          getFilesAtRef(isoGitFs, dir, commitId),
        ]),
        Effect.map(([parentEntries, currentEntries]) =>
          diffTrees(parentEntries, currentEntries)
        )
      );
    })
  );

export type GetUncommittedChangesArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

export const getUncommittedFileChanges = ({
  isoGitFs,
  dir,
}: GetUncommittedChangesArgs): Effect.Effect<
  ChangedDocument[],
  RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.statusMatrix({
          fs: isoGitFs,
          dir,
        }),
      catch: mapErrorTo(RepositoryError, 'Error reading status matrix'),
    }),
    // statusMatrix returns [filepath, HEAD, WORKDIR, STAGE]
    // [0, 2, _] = new file (not in HEAD, present in workdir)
    // [1, 0, _] = deleted (in HEAD, absent from workdir)
    // [1, 2, _] = modified (in HEAD, different in workdir)
    // [1, 1, _] = unchanged — skip
    Effect.map((matrix) =>
      matrix
        .map(
          ([filepath, headStatus, workdirStatus]): ChangedDocument | null => {
            if (headStatus === 0 && workdirStatus === 2)
              return {
                path: filepath as string,
                changeType: documentChangeTypes.ADDED,
              };
            if (headStatus === 1 && workdirStatus === 0)
              return {
                path: filepath as string,
                changeType: documentChangeTypes.DELETED,
              };
            if (headStatus === 1 && workdirStatus === 2)
              return {
                path: filepath as string,
                changeType: documentChangeTypes.MODIFIED,
              };
            return null;
          }
        )
        .filter((change): change is ChangedDocument => change !== null)
    )
  );

export type FileExistsAtCommitArgs = Omit<IsoGitDeps, 'isoGitHttp'> & {
  commitId: GitCommitHash;
  filepath: string;
};

export const fileExistsAtCommit = ({
  isoGitFs,
  dir,
  commitId,
  filepath,
}: FileExistsAtCommitArgs): Effect.Effect<
  void,
  NotFoundError | RepositoryError,
  never
> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        git.readBlob({
          fs: isoGitFs,
          dir,
          oid: commitId,
          filepath,
        }),
      catch: (err) => {
        if (err instanceof IsoGitErrors.NotFoundError) {
          return new NotFoundError(
            `File '${filepath}' not found at commit ${commitId}`
          );
        }
        return new RepositoryError('Error reading file from git');
      },
    }),
    Effect.asVoid
  );
