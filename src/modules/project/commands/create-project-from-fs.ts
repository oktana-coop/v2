import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type VersionedDocumentStore } from '../../../modules/rich-text';
import { type VersionControlId } from '../../../modules/version-control';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../filesystem';
import { StoreError as VersionedProjectStoreError } from '../errors';
import { type DocumentMetaData } from '../models';
import { type VersionedProjectStore } from '../ports/versioned-project-store';
import { createVersionedDocument } from './create-versioned-document';

export type CreateProjectFromFilesystemContentArgs = {
  directoryPath: string;
};

export type CreateProjectFromFilesystemContentDeps = {
  createProject: VersionedProjectStore['createProject'];
  createDocument: VersionedDocumentStore['createDocument'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
};

export const createProjectFromFilesystemContent =
  ({
    createProject,
    createDocument,
    listDirectoryFiles,
    readFile,
  }: CreateProjectFromFilesystemContentDeps) =>
  ({
    directoryPath,
  }: CreateProjectFromFilesystemContentArgs): Effect.Effect<
    VersionControlId,
    | VersionedProjectStoreError
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
          createVersionedDocument({
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
          documents: documents.reduce(
            (acc, doc) => {
              return { ...acc, [doc.versionControlId]: doc };
            },
            {} as Record<VersionControlId, DocumentMetaData>
          ),
        })
      )
    );
