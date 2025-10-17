import { next as Automerge } from '@automerge/automerge/slim';
import { type DocHandle, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  migrateIfNeeded,
  MigrationError,
  type VersionControlId,
  versionedArtifactTypes,
} from '../../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../utils/errors';
import { NotFoundError, RepositoryError } from '../../../errors';
import {
  type BaseArtifactMetaData,
  type SingleDocumentProject,
} from '../../../models';
import { CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION } from '../../../models';
import { type SingleDocumentProjectStore } from '../../../ports';
import { migrations } from './migrations';

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
    ({ documentMetaData, name }) =>
      pipe(
        Effect.try({
          try: () =>
            automergeRepo.create<SingleDocumentProject>({
              type: versionedArtifactTypes.SINGLE_DOCUMENT_PROJECT,
              schemaVersion: CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION,
              document: documentMetaData,
              name,
            }),
          catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
        }),
        Effect.map((handle) => handle.url)
      );

  const findProjectHandleById = (id: VersionControlId) =>
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
      }),
      Effect.tap((handle) =>
        pipe(
          migrateIfNeeded(migrations)(
            handle,
            CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION
          ),
          Effect.catchTag('VersionControlRepositoryError', () =>
            Effect.fail(new RepositoryError('Automerge repo error'))
          ),
          Effect.catchTag('VersionControlNotFoundError', () =>
            Effect.fail(new NotFoundError('Not found'))
          )
        )
      )
    );

  const findProjectById: SingleDocumentProjectStore['findProjectById'] = (id) =>
    pipe(
      findProjectHandleById(id),
      Effect.flatMap(getProjectFromHandle),
      Effect.timeoutFail({
        duration: '5 seconds',
        onTimeout: () => new NotFoundError('Timeout in finding project'),
      })
    );

  const getProjectFromHandle: SingleDocumentProjectStore['getProjectFromHandle'] =
    getDocFromHandle<SingleDocumentProject>;

  const getDocumentFromProject = (
    projectId: VersionControlId
  ): Effect.Effect<
    BaseArtifactMetaData,
    NotFoundError | RepositoryError | MigrationError,
    never
  > =>
    pipe(
      findProjectById(projectId),
      Effect.map((project) => project.document)
    );

  const findDocumentInProject: SingleDocumentProjectStore['findDocumentInProject'] =
    (projectId) =>
      pipe(
        getDocumentFromProject(projectId),
        Effect.map((document) => document.id)
      );

  const getProjectName: SingleDocumentProjectStore['getProjectName'] = (
    id: VersionControlId
  ) =>
    pipe(
      findProjectById(id),
      Effect.map((project) => project.name)
    );

  const disconnect: SingleDocumentProjectStore['disconnect'] = () =>
    Effect.tryPromise({
      try: () => automergeRepo.shutdown(),
      catch: mapErrorTo(
        RepositoryError,
        'Error in disconnecting from the project store'
      ),
    });

  return {
    createSingleDocumentProject,
    findProjectById,
    findDocumentInProject,
    getProjectFromHandle,
    getProjectName,
    disconnect,
  };
};
