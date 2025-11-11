import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  RepositoryError as VersionedDocumentRepositoryError,
  richTextRepresentationExtensions,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../../../modules/domain/rich-text';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { type ResolvedArtifactId } from '../../../../../modules/infrastructure/version-control';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type ArtifactMetaData, type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';
import { createVersionedDocumentFromFile } from './create-versioned-document-from-file';

export type CreateProjectFromFilesystemContentArgs = {
  directoryPath: string;
};

export type CreateProjectFromFilesystemContentDeps = {
  createDocument: VersionedDocumentStore['createDocument'];
  createProject: MultiDocumentProjectStore['createProject'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
};

export const createProjectFromFilesystemContent =
  ({
    createDocument,
    createProject,
    addDocumentToProject,
    listDirectoryFiles,
    readFile,
  }: CreateProjectFromFilesystemContentDeps) =>
  ({
    directoryPath,
  }: CreateProjectFromFilesystemContentArgs): Effect.Effect<
    ProjectId,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedProjectValidationError
    | VersionedDocumentRepositoryError
    | VersionedDocumentValidationError
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    pipe(
      listDirectoryFiles({
        path: directoryPath,
        extensions: [
          richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
        ],
      }),
      Effect.flatMap((directoryFiles) =>
        Effect.forEach(directoryFiles, (file) =>
          createVersionedDocumentFromFile({
            addDocumentToProject,
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
          path: directoryPath,
          documents: documents.reduce(
            (acc, doc) => {
              return { ...acc, [doc.id]: doc };
            },
            {} as Record<ResolvedArtifactId, ArtifactMetaData>
          ),
        })
      )
    );
