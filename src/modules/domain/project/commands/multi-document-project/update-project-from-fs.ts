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
  readTextFile: Filesystem['readTextFile'];
  getRelativePath: Filesystem['getRelativePath'];
};

/**
 * A file paired with its relative path for storage in the project.
 * `file.path` is the absolute path (for reading), `relativePath` is for project storage.
 */
type FileWithRelativePath = {
  file: File;
  relativePath: string;
};

const documentForFileExistsInProject = ({
  relativePath,
  fileName,
  projectDocuments,
}: {
  relativePath: string;
  fileName: string;
  projectDocuments: ArtifactMetaData[];
}): boolean =>
  projectDocuments.some(
    (docMetaData) =>
      docMetaData.name === fileName && docMetaData.path === relativePath
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
    readTextFile,
  }: {
    findDocumentById: VersionedDocumentStore['findDocumentById'];
    findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'];
    updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'];
    readTextFile: Filesystem['readTextFile'];
  }) =>
  ({
    projectId,
    file,
    relativePath,
  }: {
    projectId: ProjectId;
    file: File;
    relativePath: string;
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
        documentPath: relativePath,
        projectId,
      }),
      Effect.flatMap(({ id: documentId, artifact: document }) =>
        pipe(
          readTextFile(file.path),
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
    readTextFile,
    addDocumentToProject,
    getRelativePath,
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
        pipe(
          listDirectoryFiles({
            path: directoryPath,
            extensions: [
              richTextRepresentationExtensions[
                PRIMARY_RICH_TEXT_REPRESENTATION
              ],
            ],
            useRelativePath: false,
            recursive: true,
          }),
          Effect.flatMap((files) =>
            Effect.forEach(files, (file) =>
              pipe(
                getRelativePath({
                  path: file.path,
                  relativeTo: directoryPath,
                }),
                Effect.map(
                  (relativePath): FileWithRelativePath => ({
                    file,
                    relativePath,
                  })
                )
              )
            )
          )
        )
      ),
      Effect.tap(({ directoryFiles, projectDocuments }) =>
        Effect.forEach(
          directoryFiles,
          ({ file, relativePath }) =>
            documentForFileExistsInProject({
              relativePath,
              fileName: file.name,
              projectDocuments,
            })
              ? propagateFileChangesToVersionedDocument({
                  findDocumentById,
                  findDocumentInProject,
                  updateRichTextDocumentContent,
                  readTextFile,
                })({ file, relativePath, projectId })
              : createVersionedDocumentFromFile({
                  createDocument,
                  readTextFile,
                  addDocumentToProject,
                })({
                  file: { ...file, path: relativePath },
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
                  ({ relativePath }) => documentMetaData.path === relativePath
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
