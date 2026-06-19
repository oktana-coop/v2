import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  FilesystemAbortErrorTag,
  NotFoundError as FilesystemNotFoundError,
  removePath,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { MigrationError } from '../../../../../modules/infrastructure/version-control';
import { ASSET_FILE_EXTENSIONS } from '../../constants';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';
import { findAvailableAssetName } from '../find-available-asset-name';

export type InsertAssetInProjectArgs = {
  projectId: ProjectId;
};

export type InsertAssetInProjectResult = {
  relPath: string;
};

export type InsertAssetInProjectDeps = {
  openFile: Filesystem['openFile'];
  readBinaryFile: Filesystem['readBinaryFile'];
  lookupAssetByName: MultiDocumentProjectStore['lookupAssetByName'];
  addAssetToProject: MultiDocumentProjectStore['addAssetToProject'];
  getProjectRelativePath: MultiDocumentProjectStore['getProjectRelativePath'];
  assetsDirName: MultiDocumentProjectStore['assetsDirName'];
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
                })
              : Effect.Do.pipe(
                  Effect.bind('fileData', () => readBinaryFile(file.path)),
                  Effect.bind('resolvedName', () =>
                    findAvailableAssetName({
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
