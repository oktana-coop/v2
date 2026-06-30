import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  type Filesystem,
  FilesystemAccessControlErrorTag,
  FilesystemDataIntegrityErrorTag,
  FilesystemNotFoundErrorTag,
  FilesystemRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  createGitBlobRef,
  stageFile as stageFileInGit,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../../utils/errors';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../errors';
import { type ProjectId, type ProjectRelPath } from '../../../models';
import { type ProjectStore } from '../../../ports';
import { getCurrentBranch } from './branching';
import { findProjectById } from './project';
import { ensureProjectIdIsFsPath } from './project-id';

export const readAssetBytes = ({
  filesystem,
  projectId,
  relPath,
}: {
  filesystem: Filesystem;
  projectId: ProjectId;
  relPath: ProjectRelPath;
}): Effect.Effect<
  Uint8Array,
  NotFoundError | RepositoryError | ValidationError,
  never
> =>
  pipe(
    Effect.Do.pipe(
      Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
      Effect.bind('absolutePath', ({ projectPath }) =>
        filesystem.getAbsolutePath({ path: relPath, dirPath: projectPath })
      ),
      Effect.tap(({ projectPath, absolutePath }) =>
        pipe(
          filesystem.isDescendantPath({
            parent: projectPath,
            possibleDescendant: absolutePath,
          }),
          Effect.filterOrFail(
            (isInside) => isInside,
            () => new ValidationError('Asset path escapes project root')
          )
        )
      ),
      Effect.flatMap(({ absolutePath }) =>
        pipe(
          filesystem.readBinaryFile(absolutePath),
          Effect.map((file) => file.content)
        )
      )
    ),
    Effect.catchTags({
      [FilesystemNotFoundErrorTag]: (err) =>
        Effect.fail(new NotFoundError(err.message)),
      [FilesystemAccessControlErrorTag]: (err) =>
        Effect.fail(new RepositoryError(err.message)),
      [FilesystemRepositoryErrorTag]: (err) =>
        Effect.fail(new RepositoryError(err.message)),
      [FilesystemDataIntegrityErrorTag]: (err) =>
        Effect.fail(new RepositoryError(err.message)),
    })
  );

type AssetOps = Pick<
  ProjectStore,
  | 'addAssetToProject'
  | 'deleteAssetFromProject'
  | 'lookupAssetByName'
  | 'listProjectAssets'
  | 'readAssetBytes'
>;

export const createAssetOps = ({
  isoGitFs,
  filesystem,
  assetsDirName,
}: {
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  assetsDirName: string;
}): AssetOps => {
  const addAssetToProject: AssetOps['addAssetToProject'] = ({
    projectId,
    name,
    content,
  }) =>
    pipe(
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('currentBranch', ({ projectPath }) =>
          getCurrentBranch({ isoGitFs, projectDir: projectPath })
        ),
        Effect.bind('relPath', () =>
          Effect.succeed(`${assetsDirName}/${name}`)
        ),
        // Make sure the assets directory exists before writing into it.
        Effect.tap(({ projectPath }) =>
          pipe(
            filesystem.getAbsolutePath({
              path: assetsDirName,
              dirPath: projectPath,
            }),
            Effect.flatMap((absDir) =>
              filesystem.ensureDirectory({ path: absDir })
            )
          )
        ),
        // Resolve the asset's absolute path and write the bytes.
        Effect.tap(({ projectPath, relPath }) =>
          pipe(
            filesystem.getAbsolutePath({ path: relPath, dirPath: projectPath }),
            Effect.flatMap((absPath) =>
              filesystem.writeFile({ path: absPath, content })
            )
          )
        ),
        // Stage the new file.
        Effect.tap(({ projectPath, relPath }) =>
          stageFileInGit({ isoGitFs, dir: projectPath, path: relPath })
        ),
        // Produce the asset's git blob ref.
        Effect.flatMap(({ currentBranch, relPath }) =>
          Effect.try({
            try: () => createGitBlobRef({ ref: currentBranch, path: relPath }),
            catch: mapErrorTo(
              ValidationError,
              'Cannot create the Git blob ref for the asset'
            ),
          })
        )
      ),
      Effect.catchTags({
        [FilesystemNotFoundErrorTag]: (err) =>
          Effect.fail(new NotFoundError(err.message)),
        [FilesystemAccessControlErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [VersionControlRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
      })
    );

  const lookupAssetByName: AssetOps['lookupAssetByName'] = ({
    projectId,
    name,
  }) =>
    pipe(
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('currentBranch', ({ projectPath }) =>
          getCurrentBranch({ isoGitFs, projectDir: projectPath })
        ),
        Effect.bind('relPath', () =>
          Effect.succeed(`${assetsDirName}/${name}`)
        ),
        Effect.bind('absolutePath', ({ projectPath, relPath }) =>
          filesystem.getAbsolutePath({ path: relPath, dirPath: projectPath })
        ),
        Effect.flatMap(({ absolutePath, currentBranch, relPath }) =>
          pipe(
            filesystem.readBinaryFile(absolutePath),
            Effect.map(() =>
              createGitBlobRef({ ref: currentBranch, path: relPath })
            )
          )
        )
      ),
      Effect.catchTags({
        [FilesystemNotFoundErrorTag]: () =>
          Effect.fail(
            new NotFoundError(`No asset named "${name}" in project assets.`)
          ),
        [FilesystemAccessControlErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemDataIntegrityErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
      })
    );

  const listProjectAssets: AssetOps['listProjectAssets'] = (id) =>
    pipe(
      findProjectById({ isoGitFs, filesystem, id }),
      Effect.map((project) => Object.values(project.assets))
    );

  const readAssetBytesOp: AssetOps['readAssetBytes'] = (args) =>
    readAssetBytes({ filesystem, ...args });

  // TODO(assets): explicit asset deletion is deferred — orphan cleanup will
  // be handled by a later "prune unreferenced assets" pass.
  const deleteAssetFromProject: AssetOps['deleteAssetFromProject'] = () =>
    Effect.fail(new RepositoryError('Asset deletion is not yet implemented'));

  return {
    addAssetToProject,
    deleteAssetFromProject,
    lookupAssetByName,
    listProjectAssets,
    readAssetBytes: readAssetBytesOp,
  };
};
