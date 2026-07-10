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
} from '../../../../modules/infrastructure/filesystem';
import {
  MigrationError,
  type ResolvedArtifactId,
} from '../../../../modules/infrastructure/version-control';
import { type AssetDocRelPath } from '../../rich-text';
import { ASSET_FILE_EXTENSIONS } from '../constants';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../errors';
import {
  parseProjectRelPathEffect,
  type ProjectId,
  projectRelToDocRel,
} from '../models';
import { type ProjectStore } from '../ports';
import { findAvailableAssetName } from './find-available-asset-name';

export type InsertAssetArgs = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
};

export type InsertAssetDeps = {
  openFile: Filesystem['openFile'];
  readBinaryFile: Filesystem['readBinaryFile'];
  lookupAssetByName: ProjectStore['lookupAssetByName'];
  addAssetToProject: ProjectStore['addAssetToProject'];
  getProjectRelativePath: ProjectStore['getProjectRelativePath'];
  getArtifactPathById: ProjectStore['getArtifactPathById'];
  assetsDirName: ProjectStore['assetsDirName'];
};

export const insertAsset =
  ({
    openFile,
    readBinaryFile,
    lookupAssetByName,
    addAssetToProject,
    getProjectRelativePath,
    getArtifactPathById,
    assetsDirName,
  }: InsertAssetDeps) =>
  ({
    projectId,
    documentId,
  }: InsertAssetArgs): Effect.Effect<
    // `none` means the user cancelled the picker — a normal flow, not an
    // error. Real errors (read/write failures, repo errors) stay in the
    // error channel.
    Option.Option<AssetDocRelPath>,
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
    Effect.Do.pipe(
      // Resolve the document's project-relative path up front, so an invalid
      // id fails before the picker is shown.
      Effect.bind('docPath', () =>
        getArtifactPathById({ projectId, artifactId: documentId })
      ),
      Effect.bind('file', () =>
        openFile({ extensions: [...ASSET_FILE_EXTENSIONS] })
      ),
      // Copy the asset into the project (if it isn't already there) and resolve
      // its project-relative path.
      Effect.bind('assetProjectRelPath', ({ file }) =>
        pipe(
          // Get the asset's project-relative path (this will check if it's inside the project already).
          getProjectRelativePath({ projectId, absolutePath: file.path }),
          Effect.flatMap((assetRelativePath) =>
            assetRelativePath !== null
              ? // If the asset is already inside the project tree, reuse it.
                Effect.succeed(assetRelativePath)
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
                  Effect.map(
                    ({ resolvedName }) => `${assetsDirName}/${resolvedName}`
                  )
                )
          ),
          Effect.flatMap(parseProjectRelPathEffect)
        )
      ),
      // Express the asset's path relative to the referencing document.
      Effect.map(({ assetProjectRelPath, docPath }) =>
        projectRelToDocRel({ projectRel: assetProjectRelPath, docPath })
      ),
      Effect.map(Option.some),
      Effect.catchTag(FilesystemAbortErrorTag, () =>
        Effect.succeed(Option.none<AssetDocRelPath>())
      )
    );
