import { Repo } from '@automerge/automerge-repo/slim';

import { versionControlItemTypes } from '../../constants/versionControlItemTypes';
import type {
  DocumentMetaData,
  Project,
  RichTextDocument,
  VersionControlId,
} from '../../models';
import { VersionControlRepo } from '../../ports/version-control-repo';

export const createAdapter = (automergeRepo: Repo): VersionControlRepo => ({
  createProject: async ({ path }) => {
    const handle = automergeRepo.create<Project>({
      path,
      documents: {},
    });
    return handle.url;
  },
  findProjectById: async (id: VersionControlId) =>
    automergeRepo.find<Project>(id),
  createDocument: async ({ title, path, projectId }) => {
    const handle = automergeRepo.create<RichTextDocument>({
      type: versionControlItemTypes.RICH_TEXT_DOCUMENT,
      title,
      content: '',
    });

    const documentUrl = handle.url;

    if (projectId) {
      const project = await automergeRepo.find<Project>(projectId);

      if (project) {
        const metaData: DocumentMetaData = {
          versionControlId: documentUrl,
          name: title,
          path,
        };
        project.change((proj) => {
          proj.documents[documentUrl] = metaData;
        });
      }
    }

    return documentUrl;
  },
  findDocumentById: async (id: VersionControlId) =>
    automergeRepo.find<RichTextDocument>(id),
});
