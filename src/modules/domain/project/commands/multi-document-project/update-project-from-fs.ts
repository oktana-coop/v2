import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  NotFoundError as VersionedDocumentNotFoundError,
  RepositoryError as VersionedDocumentRepositoryError,
  richTextRepresentations,
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
  findDocumentHandleById: VersionedDocumentStore['findDocumentHandleById'];
  getDocumentFromHandle: VersionedDocumentStore['getDocumentFromHandle'];
  createDocument: VersionedDocumentStore['createDocument'];
  getRichTextDocumentContent: VersionedDocumentStore['getRichTextDocumentContent'];
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
    getRichTextDocumentContent,
    updateRichTextDocumentContent,
    findDocumentInProject: findDocumentInProjectStore,
    readFile,
  }: {
    findDocumentHandleById: VersionedDocumentStore['findDocumentHandleById'];
    findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
    getRichTextDocumentContent: VersionedDocumentStore['getRichTextDocumentContent'];
    updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'];
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
    | FilesystemRepositoryError
    | FilesystemDataIntegrityError,
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
          getDocumentFromHandle(documentHandle),
          Effect.flatMap((document) =>
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
                  getRichTextDocumentContent(document),
                  Effect.flatMap((documentRichTextContent) =>
                    fileContent.content &&
                    fileContent.content !== documentRichTextContent
                      ? updateRichTextDocumentContent({
                          documentHandle,
                          representation: richTextRepresentations.AUTOMERGE,
                          content: fileContent.content,
                        })
                      : Effect.succeed(undefined)
                  )
                )
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
    getRichTextDocumentContent,
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
                  findDocumentHandleById,
                  findDocumentInProject,
                  getRichTextDocumentContent,
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
        const projectDocumentsToDelete: Array<VersionControlId> =
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
