import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  convertToStorageFormat,
  type VersionedDocumentStore,
} from '../../../modules/rich-text';
import { type VersionControlId } from '../../../modules/version-control';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type File,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../filesystem';
import {
  NotFoundError as VersionedProjectNotFoundError,
  StoreError as VersionedProjectStoreError,
} from '../errors';
import { type DocumentMetaData } from '../models';
import type { VersionedProjectStore } from '../ports/versioned-project-store';
import { createVersionedDocument } from './create-versioned-document';

export type UpdateProjectFromFilesystemContentArgs = {
  projectId: VersionControlId;
  directoryPath: string;
};

export type UpdateProjectFromFilesystemContentDeps = {
  createDocument: VersionedProjectStore['createDocument'];
  updateDocumentSpans: VersionedDocumentStore['updateDocumentSpans'];
  listProjectDocuments: VersionedProjectStore['listProjectDocuments'];
  findDocumentInProject: VersionedProjectStore['findDocumentInProject'];
  getDocumentFromHandle: VersionedDocumentStore['getDocumentFromHandle'];
  deleteDocumentFromProject: VersionedProjectStore['deleteDocumentFromProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
};

const documentForFileExistsInProject = ({
  file,
  projectDocuments,
}: {
  file: File;
  projectDocuments: DocumentMetaData[];
}): boolean =>
  projectDocuments.some(
    (docMetaData) =>
      docMetaData.name === file.name && docMetaData.path === file.path
  );

// For files with corresponding documents in the version control repository,
// diff the content to see if anything has changed.
// Update the document according to the file content if it's changed.
// The files content is the source of truth.
const propagateFileChangesToVersionedDocument =
  ({
    updateDocumentSpans,
    findDocumentInProject,
    getDocumentFromHandle,
    readFile,
  }: {
    updateDocumentSpans: VersionedDocumentStore['updateDocumentSpans'];
    findDocumentInProject: VersionedProjectStore['findDocumentInProject'];
    getDocumentFromHandle: VersionedDocumentStore['getDocumentFromHandle'];
    readFile: Filesystem['readFile'];
  }) =>
  ({
    projectId,
    file,
  }: {
    projectId: VersionControlId;
    file: File;
  }): Effect.Effect<
    void,
    | VersionedProjectStoreError
    | VersionedProjectNotFoundError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    pipe(
      findDocumentInProject({
        documentPath: file.path!,
        projectId,
      }),
      Effect.flatMap((documentHandle) =>
        pipe(
          getDocumentFromHandle(documentHandle),
          Effect.flatMap((document) =>
            pipe(
              readFile(file.path!),
              Effect.flatMap((fileContent) => {
                if (
                  fileContent.content &&
                  fileContent.content !== convertToStorageFormat(document)
                ) {
                  return updateDocumentSpans({
                    documentHandle,
                    spans: JSON.parse(fileContent.content),
                  });
                }
                return Effect.succeed(undefined);
              })
            )
          )
        )
      )
    );

export const updateProjectFromFilesystemContent =
  ({
    createDocument,
    updateDocumentSpans,
    listProjectDocuments,
    findDocumentInProject,
    getDocumentFromHandle,
    deleteDocumentFromProject,
    listDirectoryFiles,
    readFile,
  }: UpdateProjectFromFilesystemContentDeps) =>
  ({
    projectId,
    directoryPath,
  }: UpdateProjectFromFilesystemContentArgs): Effect.Effect<
    void,
    | VersionedProjectStoreError
    | VersionedProjectNotFoundError
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('projectDocuments', () => listProjectDocuments(projectId)),
      Effect.bind('directoryFiles', () => listDirectoryFiles(directoryPath)),
      Effect.tap(({ directoryFiles, projectDocuments }) =>
        Effect.forEach(
          directoryFiles,
          (file) =>
            documentForFileExistsInProject({ file, projectDocuments })
              ? propagateFileChangesToVersionedDocument({
                  updateDocumentSpans,
                  findDocumentInProject,
                  getDocumentFromHandle,
                  readFile,
                })({ file, projectId })
              : createVersionedDocument({
                  createDocument,
                  readFile,
                })({
                  file,
                  projectId,
                }),
          { concurrency: 10 }
        )
      ),
      Effect.tap(({ directoryFiles, projectDocuments }) => {
        const projectDocumentsToDelete: Array<VersionControlId> =
          projectDocuments
            .filter(
              (documentMetaData) =>
                !directoryFiles.some(
                  (file) => documentMetaData.path === file.path
                )
            )
            .map((documentMetaData) => documentMetaData.versionControlId);

        return Effect.forEach(
          projectDocumentsToDelete,
          (id) =>
            deleteDocumentFromProject({
              documentId: id,
              projectId,
            }),
          { concurrency: 10 }
        );
      }),
      // We don't need to return anything, make the Effect's return type void.
      Effect.as(undefined)
    );
