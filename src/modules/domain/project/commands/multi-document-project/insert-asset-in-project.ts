import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  FilesystemAbortErrorTag,
  getExtension,
  NotFoundError as FilesystemNotFoundError,
  removeExtension,
  removePath,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { MigrationError } from '../../../../../modules/infrastructure/version-control';
import { ASSET_FILE_EXTENSIONS } from '../../constants';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
  VersionedProjectNotFoundErrorTag,
} from '../../errors';
import { type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';

export type InsertAssetInProjectArgs = {
  projectId: ProjectId;
};

export type InsertAssetInProjectResult = {
  relPath: string;
  alt: string;
};

export type InsertAssetInProjectDeps = {
  openFile: Filesystem['openFile'];
  readBinaryFile: Filesystem['readBinaryFile'];
  lookupAssetByName: MultiDocumentProjectStore['lookupAssetByName'];
  addAssetToProject: MultiDocumentProjectStore['addAssetToProject'];
  getProjectRelativePath: MultiDocumentProjectStore['getProjectRelativePath'];
  assetsDirName: MultiDocumentProjectStore['assetsDirName'];
};

const findAvailableName = ({
  projectId,
  desiredName,
  lookupAssetByName,
}: {
  projectId: ProjectId;
  desiredName: string;
  lookupAssetByName: MultiDocumentProjectStore['lookupAssetByName'];
}): Effect.Effect<
  string,
  | VersionedProjectValidationError
  | VersionedProjectRepositoryError
  | MigrationError,
  never
> => {
  const base = removeExtension(desiredName);
  const extension = getExtension(desiredName);
  const ext = extension ? `.${extension}` : '';

  const tryName = (
    name: string,
    attempt: number
  ): Effect.Effect<
    string,
    | VersionedProjectValidationError
    | VersionedProjectRepositoryError
    | MigrationError,
    never
  > =>
    // Inverted semantics: lookupAssetByName succeeding means a collision (an asset by
    // this name exists) and we must retry; failing with NotFound means the name is free.
    // So `flatMap` (success branch) recurses, and `catchTag` (failure branch) terminates.
    pipe(
      lookupAssetByName({ projectId, name }),
      Effect.flatMap(() => tryName(`${base}-${attempt}${ext}`, attempt + 1)),
      Effect.catchTag(VersionedProjectNotFoundErrorTag, () =>
        Effect.succeed(name)
      )
    );

  return tryName(desiredName, 1);
};

export const insertAssetInProject =
  ({
    openFile,
    readBinaryFile,
    lookupAssetByName,
    addAssetToProject,
    getProjectRelativePath,
    assetsDirName,
  }: InsertAssetInProjectDeps) =>
  ({
    projectId,
  }: InsertAssetInProjectArgs): Effect.Effect<
    // `none` means the user cancelled the picker — a normal flow, not an
    // error. Real errors (read/write failures, repo errors) stay in the
    // error channel.
    Option.Option<InsertAssetInProjectResult>,
    | VersionedProjectValidationError
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | MigrationError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | FilesystemDataIntegrityError,
    never
  > =>
    pipe(
      openFile({ extensions: [...ASSET_FILE_EXTENSIONS] }),
      Effect.flatMap((file) =>
        pipe(
          // Get the asset's project-relative path (this will check if it's inside the project already).
          getProjectRelativePath({ projectId, absolutePath: file.path }),
          Effect.flatMap((assetRelativePath) =>
            assetRelativePath !== null
              ? // If the asset is already inside the project tree, reuse it.
                Effect.succeed({
                  relPath: assetRelativePath,
                  alt: removeExtension(removePath(assetRelativePath)),
                })
              : Effect.Do.pipe(
                  Effect.bind('fileData', () => readBinaryFile(file.path)),
                  Effect.bind('resolvedName', () =>
                    findAvailableName({
                      projectId,
                      desiredName: removePath(file.path),
                      lookupAssetByName,
                    })
                  ),
                  Effect.tap(({ fileData, resolvedName }) =>
                    addAssetToProject({
                      projectId,
                      name: resolvedName,
                      content: fileData.content,
                    })
                  ),
                  Effect.map(({ resolvedName }) => ({
                    relPath: `${assetsDirName}/${resolvedName}`,
                    alt: removeExtension(resolvedName),
                  }))
                )
          )
        )
      ),
      Effect.map(Option.some),
      Effect.catchTag(FilesystemAbortErrorTag, () =>
        Effect.succeed(Option.none<InsertAssetInProjectResult>())
      )
    );
