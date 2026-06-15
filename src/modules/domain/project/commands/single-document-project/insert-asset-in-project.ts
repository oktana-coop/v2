import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  FilesystemAbortErrorTag,
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
} from '../../errors';
import { type ProjectId } from '../../models';
import { type SingleDocumentProjectStore } from '../../ports/single-document-project';
import { findAvailableAssetName } from '../find-available-asset-name';

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
  lookupAssetByName: SingleDocumentProjectStore['lookupAssetByName'];
  addAssetToProject: SingleDocumentProjectStore['addAssetToProject'];
  assetsDirName: SingleDocumentProjectStore['assetsDirName'];
};

export const insertAssetInProject =
  ({
    openFile,
    readBinaryFile,
    lookupAssetByName,
    addAssetToProject,
    assetsDirName,
  }: InsertAssetInProjectDeps) =>
  ({
    projectId,
  }: InsertAssetInProjectArgs): Effect.Effect<
    // `none` means the user cancelled the picker — a normal flow, not an
    // error. Real errors stay in the error channel.
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
      Effect.flatMap((file) => {
        const sourcePath = file.path;

        return Effect.Do.pipe(
          Effect.bind('fileData', () => readBinaryFile(sourcePath)),
          Effect.bind('resolvedName', () =>
            findAvailableAssetName({
              projectId,
              desiredName: removePath(sourcePath),
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
        );
      }),
      Effect.map(Option.some),
      Effect.catchTag(FilesystemAbortErrorTag, () =>
        Effect.succeed(Option.none<InsertAssetInProjectResult>())
      )
    );
