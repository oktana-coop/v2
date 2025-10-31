import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  getDocumentRichTextContent,
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  richTextRepresentations,
  ValidationError as VersionedDocumentValidationError,
  type VersionedDocumentStore,
} from '../../../../../modules/domain/rich-text';
import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type File,
  type Filesystem,
  isTextFile,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import {
  MigrationError,
  type ResolvedArtifactId,
} from '../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../utils/errors';
import { RICH_TEXT_FILE_EXTENSION } from '../../constants/file-extensions';
import {
  NotFoundError as VersionedProjectNotFoundError,
  RepositoryError as VersionedProjectRepositoryError,
  ValidationError as VersionedProjectValidationError,
} from '../../errors';
import { type ArtifactMetaData, type ProjectId } from '../../models';
import { type MultiDocumentProjectStore } from '../../ports/multi-document-project';
import { createVersionedDocumentFromFile } from './create-versioned-document-from-file';
import { deleteDocumentFromProject } from './delete-document-from-project';
import { findDocumentInProject } from './find-document-in-project';

export type UpdateProjectFromFilesystemContentArgs = {
  projectId: ProjectId;
  directoryPath: string;
};

export type UpdateProjectFromFilesystemContentDeps = {
  findDocumentHandleById: VersionedDocumentStore['findDocumentHandleById'];
  getDocumentFromHandle: VersionedDocumentStore['getDocumentFromHandle'];
  createDocument: VersionedDocumentStore['createDocument'];
  updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'];
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
    findDocumentHandleById,
    getDocumentFromHandle,
    updateRichTextDocumentContent,
    findDocumentInProject: findDocumentInProjectStore,
    readFile,
  }: {
    findDocumentHandleById: VersionedDocumentStore['findDocumentHandleById'];
    findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
    updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'];
    getDocumentFromHandle: VersionedDocumentStore['getDocumentFromHandle'];
    readFile: Filesystem['readFile'];
  }) =>
  ({
    projectId,
    file,
  }: {
    projectId: ProjectId;
    file: File;
  }): Effect.Effect<
    void,
    | VersionedProjectRepositoryError
    | VersionedProjectNotFoundError
    | VersionedProjectValidationError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | VersionedDocumentValidationError
    | FilesystemAccessControlError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | FilesystemDataIntegrityError
    | MigrationError,
    never
  > =>
    pipe(
      findDocumentInProject({
        findDocumentHandleById,
        findDocumentInProjectStore,
      })({
        documentPath: file.path,
        projectId,
      }),
      Effect.flatMap((documentHandle) =>
        pipe(
          readFile(file.path),
          Effect.flatMap((file) =>
            isTextFile(file)
              ? Effect.succeed(file)
              : Effect.fail(
                  new FilesystemDataIntegrityError(
                    'Expected a text file but got a binary'
                  )
                )
          ),
          Effect.flatMap((fileContent) =>
            pipe(
              getDocumentFromHandle(documentHandle),
              Effect.flatMap((document) =>
                Effect.try({
                  try: () => getDocumentRichTextContent(document),
                  catch: (err) =>
                    mapErrorTo(
                      VersionedDocumentRepositoryError,
                      'Automerge Error'
                    )(err),
                })
              ),
              Effect.flatMap((documentRichTextContent) =>
                fileContent.content &&
                fileContent.content !== documentRichTextContent
                  ? updateRichTextDocumentContent({
                      documentId: documentHandle.url,
                      representation: richTextRepresentations.AUTOMERGE,
                      content: fileContent.content,
                    })
                  : Effect.succeed(undefined)
              )
            )
          )
        )
      )
    );

export const updateProjectFromFilesystemContent =
  ({
    findDocumentHandleById,
    getDocumentFromHandle,
    createDocument,
    updateRichTextDocumentContent,
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
    | VersionedProjectValidationError
    | VersionedDocumentRepositoryError
    | VersionedDocumentNotFoundError
    | VersionedDocumentValidationError
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError
    | MigrationError,
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
                  findDocumentHandleById,
                  findDocumentInProject,
                  updateRichTextDocumentContent,
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
        const projectDocumentsToDelete: Array<ResolvedArtifactId> =
          projectDocuments
            .filter(
              (documentMetaData) =>
                !directoryFiles.some(
                  (file) => documentMetaData.path === file.path
                )
            )
            .map((documentMetaData) => documentMetaData.id);

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
