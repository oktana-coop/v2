import * as Automerge from '@automerge/automerge/slim';
import { type DocHandle, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import {
  type Branch,
  DEFAULT_BRANCH,
  migrateIfNeeded,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
  versionedArtifactTypes,
} from '../../../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../../utils/errors';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import {
  type ArtifactMetaData,
  isAutomergeUrl,
  type MultiDocumentProject,
  type ProjectId,
  type VersionedMultiDocumentProject,
  type VersionedMultiDocumentProjectHandle,
} from '../../../../models';
import { CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION } from '../../../../models';
import { MultiDocumentProjectStore } from '../../../../ports/multi-document-project';
import { migrations } from './migrations';

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
            type: versionedArtifactTypes.MULTI_DOCUMENT_PROJECT,
            schemaVersion: CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION,
            path,
            documents: {},
          }),
        catch: mapErrorTo(RepositoryError, 'Automerge repo error'),
      }),
      Effect.map((handle) => handle.url)
    );

  const findProjectHandleById = (id: ProjectId) =>
    pipe(
      Effect.succeed(id),
      Effect.filterOrFail(
        isAutomergeUrl,
        (val) => new ValidationError(`Invalid project id: ${val}`)
      ),
      Effect.flatMap((automergeUrl) =>
        Effect.tryPromise({
          try: () => automergeRepo.find<MultiDocumentProject>(automergeUrl),
          catch: (err: unknown) => {
            // TODO: This is not-future proof as it depends on the error message. Find a better way.
            if (err instanceof Error && err.message.includes('unavailable')) {
              return new NotFoundError(err.message);
            }

            return mapErrorTo(RepositoryError, 'Automerge repo error')(err);
          },
        })
      ),
      Effect.tap((handle) =>
        pipe(
          migrateIfNeeded(migrations)(
            handle,
            CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION
          ),
          Effect.catchTag(VersionControlRepositoryErrorTag, () =>
            Effect.fail(new RepositoryError('Automerge repo error'))
          ),
          Effect.catchTag(VersionControlNotFoundErrorTag, () =>
            Effect.fail(new NotFoundError('Not found'))
          )
        )
      )
    );
  const findProjectById: MultiDocumentProjectStore['findProjectById'] = (id) =>
    pipe(
      findProjectHandleById(id),
      Effect.flatMap(getProjectFromHandle),
      Effect.timeoutFail({
        duration: '5 seconds',
        onTimeout: () => new NotFoundError('Timeout in finding project'),
      })
    );

  const listProjectDocuments: MultiDocumentProjectStore['listProjectDocuments'] =
    (id) =>
      pipe(
        findProjectById(id),
        Effect.map((project) => Object.values(project.documents))
      );

  const addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'] =
    ({ documentId, name, path, projectId }) =>
      pipe(
        findProjectHandleById(projectId),
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
        findProjectHandleById(projectId),
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
                Effect.fail(
                  new NotFoundError(
                    `Document with path ${documentPath} not found in project`
                  )
                ),
              onSome: (documentMetaData) => Effect.succeed(documentMetaData.id),
            })
          )
        )
      );

  // TODO: Implement branching in Automerge
  const createAndSwitchToBranch: MultiDocumentProjectStore['createAndSwitchToBranch'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Branching is not yet supported when the app is configured with Automerge'
        )
      );

  // TODO: Implement branching in Automerge
  const switchToBranch: MultiDocumentProjectStore['switchToBranch'] = () =>
    Effect.fail(
      new RepositoryError(
        'Branching is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement branching in Automerge
  const getCurrentBranch: MultiDocumentProjectStore['getCurrentBranch'] = () =>
    Effect.succeed(DEFAULT_BRANCH as Branch);

  // TODO: Implement branching in Automerge
  const listBranches: MultiDocumentProjectStore['listBranches'] = () =>
    Effect.succeed([DEFAULT_BRANCH] as Branch[]);

  // TODO: Implement branching in Automerge
  const deleteBranch: MultiDocumentProjectStore['deleteBranch'] = () =>
    Effect.fail(
      new RepositoryError(
        'Branching is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement branching in Automerge
  const mergeAndDeleteBranch: MultiDocumentProjectStore['mergeAndDeleteBranch'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Branching is not yet supported when the app is configured with Automerge'
        )
      );

  // TODO: Implement authorship in Automerge
  const setAuthorInfo: MultiDocumentProjectStore['setAuthorInfo'] = () =>
    Effect.succeed(undefined);

  // TODO: Implement explicit sync in Automerge
  const addRemoteProject: MultiDocumentProjectStore['addRemoteProject'] = () =>
    Effect.fail(
      new RepositoryError(
        'Explicit sync is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement explicit sync in Automerge
  const pushToRemoteProject: MultiDocumentProjectStore['pushToRemoteProject'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Explicit sync is not yet supported when the app is configured with Automerge'
        )
      );

  // TODO: Implement explicit sync in Automerge
  const pullFromRemoteProject: MultiDocumentProjectStore['pullFromRemoteProject'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Explicit sync is not yet supported when the app is configured with Automerge'
        )
      );

  return {
    // TODO: Implement branching in Automerge
    supportsBranching: false,
    createProject,
    findProjectById,
    listProjectDocuments,
    addDocumentToProject,
    deleteDocumentFromProject,
    findDocumentInProject,
    createAndSwitchToBranch,
    switchToBranch,
    getCurrentBranch,
    listBranches,
    deleteBranch,
    mergeAndDeleteBranch,
    setAuthorInfo,
    addRemoteProject,
    pushToRemoteProject,
    pullFromRemoteProject,
  };
};
