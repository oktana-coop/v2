import type { File, Filesystem } from '../../filesystem';
import type { VersionControlId } from '../models';
import type { VersionControlRepo } from '../ports/version-control-repo';

const createVersionedDocument =
  ({
    createDocument,
    readFile,
  }: {
    createDocument: VersionControlRepo['createDocument'];
    readFile: Filesystem['readFile'];
  }) =>
  async ({ file, projectId }: { file: File; projectId: VersionControlId }) => {
    const readFileResult = await readFile(file.path!);
    const documentId = await createDocument({
      path: readFileResult.path!,
      name: readFileResult.name,
      title: readFileResult.name,
      content: readFileResult.content ?? null,
      projectId,
    });

    return {
      versionControlId: documentId,
      path: readFileResult.path!,
      name: readFileResult.name,
    };
  };

export const updateRepoFromFilesystemContent =
  ({
    createDocument,
    listProjectDocuments,
    findDocumentInProject,
    deleteDocumentFromProject,
    listDirectoryFiles,
    readFile,
  }: {
    createDocument: VersionControlRepo['createDocument'];
    listProjectDocuments: VersionControlRepo['listProjectDocuments'];
    findDocumentInProject: VersionControlRepo['findDocumentInProject'];
    deleteDocumentFromProject: VersionControlRepo['deleteDocumentFromProject'];
    listDirectoryFiles: Filesystem['listDirectoryFiles'];
    readFile: Filesystem['readFile'];
  }) =>
  async ({
    projectId,
    directoryPath,
  }: {
    projectId: VersionControlId;
    directoryPath: string;
  }): Promise<void> => {
    // Find project in version control repo and list its documents
    const projectDocuments = await listProjectDocuments(projectId);

    // List directory files
    const directoryFiles = await listDirectoryFiles(directoryPath);

    directoryFiles.forEach((file) => async () => {
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
        throw new Error('Could not find document in project');
      }

      const documentContent = documentHandle.docSync()?.content;
      const { content: fileContent } = await readFile(file.path!);

      if (fileContent && fileContent !== documentContent) {
        documentHandle.change((doc) => {
          doc.content = fileContent;
        });
      }
    });

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
  };
