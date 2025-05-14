import * as Effect from 'effect/Effect';

import {
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../filesystem';
import {
  NotFoundError as VersionControlNotFoundError,
  RepositoryError as VersionControlRepositoryError,
} from '../errors';
import { getSpans, type VersionControlId } from '../models';
import type { VersionControlRepo } from '../ports/version-control-repo';
import { createVersionedDocument } from './create-versioned-document';

export type UpdateProjectFromFilesystemContentArgs = {
  projectId: VersionControlId;
  directoryPath: string;
};

export type UpdateProjectFromFilesystemContentDeps = {
  createDocument: VersionControlRepo['createDocument'];
  updateDocumentSpans: VersionControlRepo['updateDocumentSpans'];
  listProjectDocuments: VersionControlRepo['listProjectDocuments'];
  findDocumentInProject: VersionControlRepo['findDocumentInProject'];
  deleteDocumentFromProject: VersionControlRepo['deleteDocumentFromProject'];
  listDirectoryFiles: Filesystem['listDirectoryFiles'];
  readFile: Filesystem['readFile'];
};

export const updateProjectFromFilesystemContent =
  ({
    createDocument,
    updateDocumentSpans,
    listProjectDocuments,
    findDocumentInProject,
    deleteDocumentFromProject,
    listDirectoryFiles,
    readFile,
  }: UpdateProjectFromFilesystemContentDeps) =>
  ({
    projectId,
    directoryPath,
  }: UpdateProjectFromFilesystemContentArgs): Effect.Effect<
    void,
    | VersionControlRepositoryError
    | VersionControlNotFoundError
    | FilesystemAccessControlError
    | FilesystemDataIntegrityError
    | FilesystemNotFoundError
    | FilesystemRepositoryError,
    never
  > =>
    Effect.Do.pipe(
      Effect.bind('projectDocuments', () => listProjectDocuments(projectId)),
      Effect.bind('directoryFiles', () => listDirectoryFiles(directoryPath)),
      Effect.flatMap(({ directoryFiles, projectDocuments }) =>
        Effect.forEach(directoryFiles, (file) => {
          // If a document corresponding to the file is not found in the version control repository, create it.
          if (
            !projectDocuments.some(
              (docMetaData) =>
                docMetaData.name === file.name && docMetaData.path === file.path
            )
          ) {
            return createVersionedDocument({
              createDocument,
              readFile,
            })({
              file,
              projectId,
            });
          }
        })
      )
    );

{
  // Find project in version control repo and list its documents
  const projectDocuments = await listProjectDocuments(projectId);

  // List directory files
  const directoryFiles = await listDirectoryFiles(directoryPath);

  const directoryFileTasks = directoryFiles.map(async (file) => {
    // If a document corresponding to the file is not found in the version control repository, create it.
    if (
      !projectDocuments.some(
        (docMetaData) =>
          docMetaData.name === file.name && docMetaData.path === file.path
      )
    ) {
      await createVersionedDocument({
        createDocument,
        readFile,
      })({
        file,
        projectId,
      });
    }

    // For files with corresponding documents in the version control repository,
    // diff the content to see if anything has changed.
    // Update the document according to the file content if it's changed.
    // The files content is the source of truth.
    const documentHandle = await findDocumentInProject({
      documentPath: file.path!,
      projectId,
    });

    if (!documentHandle) {
      throw new Error('Could not find document handle in project');
    }

    const document = await documentHandle.doc();
    if (!document) {
      throw new Error('Could not find document in project');
    }

    const documentSpans = getSpans(document);
    const { content: fileContent } = await readFile(file.path!);

    // File content is the JSON-stringified document spans
    if (fileContent && fileContent !== JSON.stringify(documentSpans)) {
      await updateDocumentSpans({
        documentHandle,
        spans: JSON.parse(fileContent),
      });
    }
  });

  await Promise.all(directoryFileTasks);

  // Delete project documents that are not found in the directory.
  // The source of truth is the directory content.
  const projectDocumentsToDelete: Array<VersionControlId> = projectDocuments
    .filter(
      (documentMetaData) =>
        !directoryFiles.some((file) => documentMetaData.path === file.path)
    )
    .map((documentMetaData) => documentMetaData.versionControlId);

  const deleteDocumentPromises = projectDocumentsToDelete.map((id) =>
    deleteDocumentFromProject({ documentId: id, projectId })
  );

  await Promise.all(deleteDocumentPromises);
}
