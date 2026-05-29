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
import { type SingleDocumentProjectStore } from '../../ports/single-document-project';

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

const findAvailableName = ({
  projectId,
  desiredName,
  lookupAssetByName,
}: {
  projectId: ProjectId;
  desiredName: string;
  lookupAssetByName: SingleDocumentProjectStore['lookupAssetByName'];
}): Effect.Effect<
  string,
  | VersionedProjectValidationError
  | VersionedProjectRepositoryError
  | MigrationError,
  never
> => {
  const base = removeExtension(desiredName);
  const ext = getExtension(desiredName);
  const suffix = ext ? `.${ext}` : '';

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
      Effect.flatMap(() => tryName(`${base}-${attempt}${suffix}`, attempt + 1)),
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
            findAvailableName({
              projectId,
              desiredName: removePath(sourcePath),
              lookupAssetByName,
            })
          ),
          Effect.bind('_added', ({ fileData, resolvedName }) =>
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
