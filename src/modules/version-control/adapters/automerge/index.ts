import { next as Automerge } from '@automerge/automerge/slim';
import { RawString, Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import { mapErrorTo } from '../../../../utils/errors';
import { versionControlItemTypes } from '../../constants/version-control-item-types';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  type DocumentMetaData,
  type Project,
  type RichTextDocument,
  type VersionControlId,
  type VersionedProject,
  type VersionedProjectHandle,
} from '../../models';
import { VersionControlRepo } from '../../ports/version-control-repo';

export const createAdapter = (automergeRepo: Repo): VersionControlRepo => {
  const getProjectFromHandle: (
    handle: VersionedProjectHandle
  ) => Effect.Effect<
    VersionedProject,
    RepositoryError | NotFoundError,
    never
  > = (handle) =>
    pipe(
      Effect.tryPromise({
        try: async () => await handle.doc(),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.flatMap((doc) =>
        pipe(
          Option.fromNullable(doc),
          Option.match({
            onNone: () =>
              Effect.fail(new NotFoundError('Project not found in handle')),
            onSome: (project) => Effect.succeed(project),
          })
        )
      )
    );

  const createProject: VersionControlRepo['createProject'] = ({ path }) =>
    pipe(
      Effect.try({
        try: () =>
          automergeRepo.create<Project>({
            path,
            documents: {},
          }),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.map((handle) => handle.url)
    );

  const findProjectById: VersionControlRepo['findProjectById'] = (
    id: VersionControlId
  ) =>
    pipe(
      Effect.tryPromise({
        try: () => automergeRepo.find<Project>(id),
        catch: (err: unknown) => {
          // TODO: This is not-future proof as it depends on the error message. Find a better way.
          if (err instanceof Error && err.message.includes('unavailable')) {
            return new NotFoundError(err.message);
          }

          return mapErrorTo(RepositoryError, 'Automerge repo error')(err);
        },
      })
    );

  const listProjectDocuments: VersionControlRepo['listProjectDocuments'] = (
    id: VersionControlId
  ) =>
    pipe(
      findProjectById(id),
      Effect.flatMap(getProjectFromHandle),
      Effect.map((project) => Object.values(project.documents))
    );

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
  };
};
