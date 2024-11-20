import type { File, Filesystem } from '../../filesystem';
import type { VersionControlId } from '../models';
import type { VersionControlRepo } from '../ports/version-control-repo';

export const createVersionedDocument =
  ({
    createDocument,
    readFile,
  }: {
    createDocument: VersionControlRepo['createDocument'];
    readFile: Filesystem['readFile'];
  }) =>
  async ({
    file,
    projectId,
  }: {
    file: File;
    projectId: VersionControlId | null;
  }) => {
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
