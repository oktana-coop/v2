import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../modules/rich-text';
import { type VersionControlId } from '../../../modules/version-control';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../filesystem';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../errors';
import { type ArtifactMetaData } from '../models';
import { type VersionedProjectStore } from '../ports/versioned-project-store';
import { createVersionedDocumentFromFile } from './create-versioned-document-from-file';

export type CreateProjectFromFilesystemContentArgs = {
  directoryPath: string;
};

export type CreateProjectFromFilesystemContentDeps = {
  createDocument: VersionedDocumentStore['createDocument'];
  createProject: VersionedProjectStore['createProject'];
  addArtifactToProject: VersionedProjectStore['addArtifactToProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
};

export const createProjectFromFilesystemContent =
  ({
    createDocument,
    createProject,
    addArtifactToProject,
    listDirectoryFiles,
    readFile,
  }: CreateProjectFromFilesystemContentDeps) =>
  ({
    directoryPath,
  }: CreateProjectFromFilesystemContentArgs): Effect.Effect<
    VersionControlId,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedDocumentRepositoryError
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    pipe(
      listDirectoryFiles(directoryPath),
      Effect.flatMap((directoryFiles) =>
        Effect.forEach(directoryFiles, (file) =>
          createVersionedDocumentFromFile({
            addArtifactToProject,
            createDocument,
            readFile,
          })({
            file,
            projectId: null,
          })
        )
      ),
      Effect.flatMap((documents) =>
        createProject({
          path: directoryPath!,
          artifacts: documents.reduce(
            (acc, doc) => {
              return { ...acc, [doc.versionControlId]: doc };
            },
            {} as Record<VersionControlId, ArtifactMetaData>
          ),
        })
      )
    );
