import { next as Automerge } from '@automerge/automerge/slim';
import { type DocHandle, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type VersionControlId } from '../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import { NotFoundError, RepositoryError } from '../../errors';
import {
  type BaseArtifactMetaData,
  type SingleDocumentProject,
  type SingleDocumentProjectHandle,
} from '../../models';
import { type SingleDocumentProjectStore } from '../../ports';

export const createAdapter = (
  automergeRepo: Repo
): SingleDocumentProjectStore => {
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

  const createSingleDocumentProject: SingleDocumentProjectStore['createSingleDocumentProject'] =
    (documentMetaData) =>
      pipe(
        Effect.try({
          try: () =>
            automergeRepo.create<SingleDocumentProject>({
              document: documentMetaData,
              assets: {},
            }),
          catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
        }),
        Effect.map((handle) => handle.url)
      );

  const findProjectById = (id: VersionControlId) =>
    pipe(
      Effect.tryPromise({
        try: () => automergeRepo.find<SingleDocumentProject>(id),
        catch: (err: unknown) => {
          // TODO: This is not-future proof as it depends on the error message. Find a better way.
          if (err instanceof Error && err.message.includes('unavailable')) {
            return new NotFoundError(err.message);
          }

          return mapErrorTo(RepositoryError, 'Automerge repo error')(err);
        },
      })
    );

  const getProjectFromHandle: (
    handle: SingleDocumentProjectHandle
  ) => Effect.Effect<
    SingleDocumentProject,
    RepositoryError | NotFoundError,
    never
  > = getDocFromHandle<SingleDocumentProject>;

  const getDocumentFromProject = (
    projectId: VersionControlId
  ): Effect.Effect<
    BaseArtifactMetaData,
    NotFoundError | RepositoryError,
    never
  > =>
    pipe(
      findProjectById(projectId),
      Effect.flatMap(getProjectFromHandle),
      Effect.map((project) => project.document)
    );

  const findDocumentInProject: SingleDocumentProjectStore['findDocumentInProject'] =
    (projectId) =>
      pipe(
        getDocumentFromProject(projectId),
        Effect.map((document) => document.versionControlId)
      );

  return {
    createSingleDocumentProject,
    findDocumentInProject,
  };
};
