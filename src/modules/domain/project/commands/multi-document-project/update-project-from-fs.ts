import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  getDocumentRichTextContent,
  NotFoundError as VersionedDocumentNotFoundError,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  RepositoryError as VersionedDocumentRepositoryError,
  richTextRepresentationExtensions,
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
  findDocumentById: VersionedDocumentStore['findDocumentById'];
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
    findDocumentById,
    updateRichTextDocumentContent,
    findDocumentInProject: findDocumentInProjectStore,
    readFile,
  }: {
    findDocumentById: VersionedDocumentStore['findDocumentById'];
    findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
    updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'];
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
        findDocumentById,
        findDocumentInProjectStore,
      })({
        documentPath: file.path,
        projectId,
      }),
      Effect.flatMap(({ id: documentId, artifact: document }) =>
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
              Effect.try({
                try: () => getDocumentRichTextContent(document),
                catch: (err) =>
                  mapErrorTo(
                    VersionedDocumentRepositoryError,
                    'Automerge Error'
                  )(err),
              }),
              Effect.flatMap((documentRichTextContent) =>
                fileContent.content &&
                fileContent.content !== documentRichTextContent
                  ? updateRichTextDocumentContent({
                      documentId,
                      representation: PRIMARY_RICH_TEXT_REPRESENTATION,
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
    findDocumentById,
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
          extensions: [
            richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
          ],
          useRelativePath: true,
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
                  updateRichTextDocumentContent,
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
