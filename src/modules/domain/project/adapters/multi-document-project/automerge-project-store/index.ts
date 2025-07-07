import { next as Automerge } from '@automerge/automerge/slim';
import { type DocHandle, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import { type VersionControlId } from '../../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../utils/errors';
import { NotFoundError, RepositoryError } from '../../../errors';
import {
  type ArtifactMetaData,
  type MultiDocumentProject,
  type VersionedMultiDocumentProject,
  type VersionedMultiDocumentProjectHandle,
} from '../../../models';
import { MultiDocumentProjectStore } from '../../../ports/multi-document-project';

export const createAdapter = (
  automergeRepo: Repo
): MultiDocumentProjectStore => {
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
    handle: VersionedMultiDocumentProjectHandle
  ) => Effect.Effect<
    VersionedMultiDocumentProject,
    RepositoryError | NotFoundError,
    never
  > = getDocFromHandle<VersionedMultiDocumentProject>;

  const createProject: MultiDocumentProjectStore['createProject'] = ({
    path,
  }) =>
    pipe(
      Effect.try({
        try: () =>
          automergeRepo.create<MultiDocumentProject>({
            path,
            documents: {},
          }),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.map((handle) => handle.url)
    );

  const findProjectById: MultiDocumentProjectStore['findProjectById'] = (
    id: VersionControlId
  ) =>
    pipe(
      Effect.tryPromise({
        try: () => automergeRepo.find<MultiDocumentProject>(id),
        catch: (err: unknown) => {
          // TODO: This is not-future proof as it depends on the error message. Find a better way.
          if (err instanceof Error && err.message.includes('unavailable')) {
            return new NotFoundError(err.message);
          }

          return mapErrorTo(RepositoryError, 'Automerge repo error')(err);
        },
      })
    );

  const listProjectDocuments: MultiDocumentProjectStore['listProjectDocuments'] =
    (id: VersionControlId) =>
      pipe(
        findProjectById(id),
        Effect.flatMap(getProjectFromHandle),
        Effect.map((project) => Object.values(project.documents))
      );

  const addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'] =
    ({ documentId, name, path, projectId }) =>
      pipe(
        findProjectById(projectId),
        Effect.flatMap((projectHandle) => {
          const metaData: ArtifactMetaData = {
            id: documentId,
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

  const deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'] =
    ({ projectId, documentId }) =>
      pipe(
        findProjectById(projectId),
        Effect.tap((projectHandle) =>
          Effect.try({
            try: () =>
              projectHandle.change((project) => {
                delete project.documents[documentId];
              }),
            catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
          })
        )
      );

  const findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'] =
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
              onSome: (documentMetaData) => Effect.succeed(documentMetaData.id),
            })
          )
        )
      );

  return {
    createProject,
    findProjectById,
    listProjectDocuments,
    addDocumentToProject,
    deleteDocumentFromProject,
    findDocumentInProject,
    getProjectFromHandle,
  };
};
