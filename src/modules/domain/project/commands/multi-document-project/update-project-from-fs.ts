import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  convertToStorageFormat,
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  type VersionedDocumentStore,
} from '../../../../../modules/domain/rich-text';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type File,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { type VersionControlId } from '../../../../../modules/infrastructure/version-control';
import { RICH_TEXT_FILE_EXTENSION } from '../../constants/file-extensions';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
} from '../../errors';
import { type ArtifactMetaData } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';
import { createVersionedDocumentFromFile } from './create-versioned-document-from-file';
import { deleteDocumentFromProject } from './delete-document-from-project';
import { findDocumentInProject } from './find-document-in-project';

export type UpdateProjectFromFilesystemContentArgs = {
  projectId: VersionControlId;
  directoryPath: string;
};

export type UpdateProjectFromFilesystemContentDeps = {
  findDocumentById: VersionedDocumentStore['findDocumentById'];
  getDocumentFromHandle: VersionedDocumentStore['getDocumentFromHandle'];
  createDocument: VersionedDocumentStore['createDocument'];
  updateDocumentSpans: VersionedDocumentStore['updateDocumentSpans'];
  deleteDocument: VersionedDocumentStore['deleteDocument'];
  addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'];
  findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
  listProjectDocuments: MultiDocumentProjectStore['listProjectDocuments'];
  deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
};

const documentForFileExistsInProject = ({
  file,
  projectDocuments,
}: {
  file: File;
  projectDocuments: ArtifactMetaData[];
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
    findDocumentById,
    getDocumentFromHandle,
    updateDocumentSpans,
    findDocumentInProject: findDocumentInProjectStore,
    readFile,
  }: {
    findDocumentById: VersionedDocumentStore['findDocumentById'];
    findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
    updateDocumentSpans: VersionedDocumentStore['updateDocumentSpans'];
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
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    pipe(
      findDocumentInProject({
        findDocumentById,
        findDocumentInProjectStore,
      })({
        documentPath: file.path,
        projectId,
      }),
      Effect.flatMap((documentHandle) =>
        pipe(
          getDocumentFromHandle(documentHandle),
          Effect.flatMap((document) =>
            pipe(
              readFile(file.path),
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
    findDocumentById,
    getDocumentFromHandle,
    createDocument,
    updateDocumentSpans,
    deleteDocument,
    listProjectDocuments,
    findDocumentInProject,
    deleteDocumentFromProject: deleteDocumentFromProjectStore,
    listDirectoryFiles,
    readFile,
    addDocumentToProject,
  }: UpdateProjectFromFilesystemContentDeps) =>
  ({
    projectId,
    directoryPath,
  }: UpdateProjectFromFilesystemContentArgs): Effect.Effect<
    void,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('projectDocuments', () => listProjectDocuments(projectId)),
      Effect.bind('directoryFiles', () =>
        listDirectoryFiles({
          path: directoryPath,
          extensions: [RICH_TEXT_FILE_EXTENSION],
        })
      ),
      Effect.tap(({ directoryFiles, projectDocuments }) =>
        Effect.forEach(
          directoryFiles,
          (file) =>
            documentForFileExistsInProject({ file, projectDocuments })
              ? propagateFileChangesToVersionedDocument({
                  findDocumentById,
                  findDocumentInProject,
                  updateDocumentSpans,
                  getDocumentFromHandle,
                  readFile,
                })({ file, projectId })
              : createVersionedDocumentFromFile({
                  createDocument,
                  readFile,
                  addDocumentToProject,
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
              deleteDocument,
              deleteDocumentFromProjectStore,
            })({
              documentId: id,
              projectId,
            }),
          { concurrency: 10 }
        );
      }),
      // We don't need to return anything, make the Effect's return type void.
      Effect.as(undefined)
    );
