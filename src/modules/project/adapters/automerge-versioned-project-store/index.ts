import { next as Automerge } from '@automerge/automerge/slim';
import { type DocHandle, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import { type RichTextDocument } from '../../../../modules/rich-text';
import {
  type VersionControlId,
  versionedArtifactTypes,
} from '../../../../modules/version-control';
import { fromNullable } from '../../../../utils/effect';
import { mapErrorTo } from '../../../../utils/errors';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  type DocumentMetaData,
  type Project,
  type VersionedProject,
  type VersionedProjectHandle,
} from '../../models';
import { VersionedProjectStore } from '../../ports/versioned-project-store';

export const createAdapter = (automergeRepo: Repo): VersionedProjectStore => {
  const getDocFromHandle: <T>(
    handle: DocHandle<T>
  ) => Effect.Effect<
    Automerge.Doc<T>,
    RepositoryError | NotFoundError,
    never
  > = (handle) =>
    pipe(
      Effect.tryPromise({
        try: async () => await handle.doc(),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.flatMap((doc) =>
        fromNullable(doc, () => new NotFoundError('Doc not found in handle'))
      )
    );

  const getProjectFromHandle: (
    handle: VersionedProjectHandle
  ) => Effect.Effect<VersionedProject, RepositoryError | NotFoundError, never> =
    getDocFromHandle<VersionedProject>;

  const createProject: VersionedProjectStore['createProject'] = ({ path }) =>
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

  const findProjectById: VersionedProjectStore['findProjectById'] = (
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

  const listProjectDocuments: VersionedProjectStore['listProjectDocuments'] = (
    id: VersionControlId
  ) =>
    pipe(
      findProjectById(id),
      Effect.flatMap(getProjectFromHandle),
      Effect.map((project) => Object.values(project.documents))
    );

  const addDocumentToProject = ({
    documentId,
    name,
    path,
    projectId,
  }: {
    documentId: VersionControlId;
    name: string;
    path: string;
    projectId: VersionControlId;
  }): Effect.Effect<void, RepositoryError | NotFoundError, never> =>
    pipe(
      findProjectById(projectId),
      Effect.flatMap((projectHandle) => {
        const metaData: DocumentMetaData = {
          versionControlId: documentId,
          name,
          path,
        };

        return Effect.try({
          try: () =>
            projectHandle.change((project) => {
              project.documents[documentId] = metaData;
            }),
          catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
        });
      })
    );

  const createDocument: VersionedProjectStore['createDocument'] = ({
    title,
    name,
    path,
    content,
    projectId,
  }) =>
    pipe(
      Effect.try({
        try: () =>
          automergeRepo.create<RichTextDocument>({
            type: versionedArtifactTypes.RICH_TEXT_DOCUMENT,
            title,
            content: content ?? '',
          }),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.map((handle) => handle.url),
      Effect.tap((documentId) =>
        pipe(
          Option.fromNullable(projectId),
          Option.match({
            onNone: () => Effect.as(undefined),
            onSome: (projId) =>
              pipe(
                addDocumentToProject({
                  documentId,
                  name,
                  path,
                  projectId: projId,
                })
              ),
          })
        )
      )
    );

  const deleteDocumentFromProject: VersionedProjectStore['deleteDocumentFromProject'] =
    ({ projectId, documentId }) =>
      pipe(
        Effect.all([findProjectById(projectId), findDocumentById(documentId)]),
        Effect.tap(([projectHandle]) =>
          Effect.try({
            try: () =>
              projectHandle.change((project) => {
                delete project.documents[documentId];
              }),
            catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
          })
        ),
        Effect.tap(([, documentHandle]) =>
          Effect.try({
            try: () => documentHandle.delete(),
            catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
          })
        )
      );

  const findDocumentInProject: VersionedProjectStore['findDocumentInProject'] =
    ({ projectId, documentPath }) =>
      pipe(
        listProjectDocuments(projectId),
        Effect.flatMap((projectDocuments) =>
          pipe(
            Option.fromNullable(
              projectDocuments.find(
                (documentMetaData) => documentMetaData.path === documentPath
              )
            ),
            Option.match({
              onNone: () =>
                Effect.fail(new NotFoundError('Document not found in project')),
              onSome: (documentMetaData) =>
                Effect.succeed(documentMetaData.versionControlId),
            })
          )
        ),
        Effect.flatMap(findDocumentById)
      );

  return {
    createProject,
    findProjectById,
    listProjectDocuments,
    createDocument,
    deleteDocumentFromProject,
    findDocumentInProject,
    getProjectFromHandle,
  };
};
