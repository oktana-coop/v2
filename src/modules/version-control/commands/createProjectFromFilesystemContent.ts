import type { Filesystem } from '../../filesystem';
import type { DocumentMetaData, VersionControlId } from '../models';
import type { VersionControlRepo } from '../ports/version-control-repo';
import { createVersionedDocument } from './createVersionedDocument';

export const createProjectFromFilesystemContent =
  ({
    createProject,
    createDocument,
    listDirectoryFiles,
    readFile,
  }: {
    createProject: VersionControlRepo['createProject'];
    createDocument: VersionControlRepo['createDocument'];
    listDirectoryFiles: Filesystem['listDirectoryFiles'];
    readFile: Filesystem['readFile'];
  }) =>
  async ({
    directoryPath,
  }: {
    directoryPath: string;
  }): Promise<VersionControlId> => {
    // List directory files
    const directoryFiles = await listDirectoryFiles(directoryPath);

    const documents = await Promise.all(
      directoryFiles.map((file) =>
        createVersionedDocument({
          createDocument,
          readFile,
        })({
          file,
          projectId: null,
        })
      )
    );

    const projectId = await createProject({
      path: directoryPath!,
      documents: documents.reduce(
        (acc, doc) => {
          return { ...acc, [doc.versionControlId]: doc };
        },
        {} as Record<VersionControlId, DocumentMetaData>
      ),
    });

    return projectId;
  };
