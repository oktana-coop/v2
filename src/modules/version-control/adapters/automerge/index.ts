import { next as Automerge } from '@automerge/automerge/slim';
import { RawString, Repo } from '@automerge/automerge-repo/slim';

import { versionControlItemTypes } from '../../constants/version-control-item-types';
import {
  VersionedDocument,
  type DocumentMetaData,
  type Project,
  type RichTextDocument,
  type VersionControlId,
  type VersionedProject,
} from '../../models';
import { VersionControlRepo } from '../../ports/version-control-repo';

export const createAdapter = (automergeRepo: Repo): VersionControlRepo => {
  const createProject: VersionControlRepo['createProject'] = async ({
    path,
  }) => {
    const handle = await automergeRepo.create<Project>({
      path,
      documents: {},
    });
    return handle.url;
  };

  const findProjectById: VersionControlRepo['findProjectById'] = async (
    id: VersionControlId
  ) => {
    const handle = await automergeRepo.find<Project>(id);

    if (!handle) {
      return null;
    }

    await handle.whenReady();
    return handle;
  };

  const listProjectDocuments: VersionControlRepo['listProjectDocuments'] =
    async (id: VersionControlId) => {
      const projectHandle = await findProjectById(id);
      if (!projectHandle) {
        throw new Error('Could not retrieve project handle from repository');
      }

      const project: VersionedProject | null =
        (await projectHandle.doc()) ?? null;

      if (!project) {
        throw new Error('Could not retrieve project from repository');
      }

      return Object.values(project.documents);
    };

  const createDocument: VersionControlRepo['createDocument'] = async ({
    title,
    name,
    path,
    content,
    projectId,
  }) => {
    const handle = await automergeRepo.create<RichTextDocument>({
      type: versionControlItemTypes.RICH_TEXT_DOCUMENT,
      title,
      content: content ?? '',
    });

    const documentUrl = handle.url;

    if (projectId) {
      const projectHandle = await findProjectById(projectId);

      if (projectHandle) {
        const metaData: DocumentMetaData = {
          versionControlId: documentUrl,
          name,
          path,
        };

        projectHandle.change((project) => {
          project.documents[documentUrl] = metaData;
        });
      }
    }

    return documentUrl;
  };

  const getDocumentHandleAtCommit: VersionControlRepo['getDocumentHandleAtCommit'] =
    ({ documentHandle, heads }) => {
      return documentHandle.view(heads);
    };

  const getWriteableHandleAtCommit: VersionControlRepo['getWriteableHandleAtCommit'] =
    async ({ documentHandle, heads }) => {
      const docHandle = documentHandle.view(heads);
      const doc = await docHandle.doc();
      const clonedDoc = Automerge.clone(doc!);
      // Create a new document in the repo with the cloned content
      const clonedHandle = automergeRepo.create<VersionedDocument>();
      clonedHandle.change((doc) => Object.assign(doc, clonedDoc));
      return clonedHandle;
    };

  const findDocumentById: VersionControlRepo['findDocumentById'] = async (
    id: VersionControlId
  ) => {
    const handle = await automergeRepo.find<RichTextDocument>(id);

    if (!handle) {
      return null;
    }

    await handle.whenReady();
    return handle;
  };

  const deleteDocumentFromProject: VersionControlRepo['deleteDocumentFromProject'] =
    async ({ projectId, documentId }) => {
      const projectHandle = await findProjectById(projectId);
      if (!projectHandle) {
        throw new Error('No project handle found in repository');
      }

      const documentHandle = await findDocumentById(documentId);
      if (!documentHandle) {
        throw new Error('No document handle found in repository');
      }

      projectHandle.change((project) => {
        delete project.documents[documentId];
      });

      documentHandle.delete();
    };

  const findDocumentInProject: VersionControlRepo['findDocumentInProject'] =
    async ({ projectId, documentPath }) => {
      const projectDocuments = await listProjectDocuments(projectId);

      const documentId = projectDocuments.find(
        (documentMetaData) => documentMetaData.path === documentPath
      )?.versionControlId;

      if (!documentId) {
        return null;
      }

      return findDocumentById(documentId);
    };

  const updateDocumentSpans: VersionControlRepo['updateDocumentSpans'] =
    async ({ documentHandle, spans }) => {
      documentHandle.change((doc) => {
        Automerge.updateSpans(
          doc,
          ['content'],
          spans.map((span) =>
            span.type === 'block'
              ? // Manually create the raw string for block types
                {
                  ...span,
                  value: {
                    ...span.value,
                    type: new RawString(span.value.type as string),
                  },
                }
              : // Inline span as-is
                span
          )
        );
      });
    };

  return {
    createProject,
    findProjectById,
    listProjectDocuments,
    createDocument,
    getDocumentHandleAtCommit,
    findDocumentById,
    deleteDocumentFromProject,
    findDocumentInProject,
    updateDocumentSpans,
    getWriteableHandleAtCommit,
  };
};
