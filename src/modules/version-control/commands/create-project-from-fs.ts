import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../filesystem';
import { RepositoryError as VersionControlRepositoryError } from '../errors';
import type { DocumentMetaData, VersionControlId } from '../models';
import type { VersionControlRepo } from '../ports/version-control-repo';
import { createVersionedDocument } from './create-versioned-document';

export type CreateProjectFromFilesystemContentArgs = {
  directoryPath: string;
};

export type CreateProjectFromFilesystemContentDeps = {
  createProject: VersionControlRepo['createProject'];
  createDocument: VersionControlRepo['createDocument'];
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
    | VersionControlRepositoryError
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
