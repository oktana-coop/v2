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
} from '../../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../../utils/effect';
import { mapErrorTo } from '../../../../../../utils/errors';
import { DEFAULT_ASSETS_DIR_NAME } from '../../../constants';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../errors';
import {
  type ArtifactMetaData,
  isAutomergeUrl,
  type Project,
  type ProjectId,
  type VersionedProject,
  type VersionedProjectHandle,
} from '../../../models';
import { CURRENT_PROJECT_SCHEMA_VERSION } from '../../../models';
import { ProjectStore } from '../../../ports';
import { migrations } from './migrations';

export const createAdapter = (automergeRepo: Repo): ProjectStore => {
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

  const createProject: ProjectStore['createProject'] = ({ path }) =>
    pipe(
      Effect.try({
        try: () =>
          automergeRepo.create<Project>({
            type: versionedArtifactTypes.PROJECT,
            schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
            path,
            documents: {},
            assets: {},
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
          try: () => automergeRepo.find<Project>(automergeUrl),
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
          migrateIfNeeded(migrations)(handle, CURRENT_PROJECT_SCHEMA_VERSION),
          Effect.catchTag(VersionControlRepositoryErrorTag, () =>
            Effect.fail(new RepositoryError('Automerge repo error'))
          ),
          Effect.catchTag(VersionControlNotFoundErrorTag, () =>
            Effect.fail(new NotFoundError('Not found'))
          )
        )
      )
    );
  const findProjectById: ProjectStore['findProjectById'] = (id) =>
    pipe(
      findProjectHandleById(id),
      Effect.flatMap(getProjectFromHandle),
      Effect.timeoutFail({
        duration: '5 seconds',
        onTimeout: () => new NotFoundError('Timeout in finding project'),
      })
    );

  const listProjectDocuments: ProjectStore['listProjectDocuments'] = (id) =>
    pipe(
      findProjectById(id),
      Effect.map((project) => Object.values(project.documents))
    );

  const addDocumentToProject: ProjectStore['addDocumentToProject'] = ({
    documentId,
    name,
    path,
    projectId,
  }) =>
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

  const deleteDocumentFromProject: ProjectStore['deleteDocumentFromProject'] =
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

  // TODO: Implement deleteDocumentsFromProject for Automerge
  const deleteDocumentsFromProject: ProjectStore['deleteDocumentsFromProject'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Batch document deletion is not supported for Automerge.'
        )
      );

  // TODO: Implement renameDocumentInProject for Automerge
  const renameDocumentInProject: ProjectStore['renameDocumentInProject'] = () =>
    Effect.fail(
      new RepositoryError('Rename not yet implemented for Automerge')
    );

  // TODO: Implement renameDocumentsInProject for Automerge
  const renameDocumentsInProject: ProjectStore['renameDocumentsInProject'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Batch document rename is not supported for Automerge.'
        )
      );

  const findDocumentInProject: ProjectStore['findDocumentInProject'] = ({
    projectId,
    documentPath,
  }) =>
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

  // TODO: Implement multi-doc commits in Automerge
  const commitChanges: ProjectStore['commitChanges'] = () =>
    Effect.fail(
      new RepositoryError(
        'Committing changes to a project has not yet been implemented in Automerge'
      )
    );

  const commitDocumentChanges: ProjectStore['commitDocumentChanges'] = () =>
    Effect.fail(
      new RepositoryError(
        'Committing changes to a document has not yet been implemented in Automerge'
      )
    );

  const restoreDocumentChanges: ProjectStore['restoreDocumentChanges'] = () =>
    Effect.fail(
      new RepositoryError(
        'Restoring a document to an earlier commit has not yet been implemented in Automerge'
      )
    );

  // TODO: Implement branching in Automerge
  const createAndSwitchToBranch: ProjectStore['createAndSwitchToBranch'] = () =>
    Effect.fail(
      new RepositoryError(
        'Branching is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement branching in Automerge
  const switchToBranch: ProjectStore['switchToBranch'] = () =>
    Effect.fail(
      new RepositoryError(
        'Branching is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement branching in Automerge
  const getCurrentBranch: ProjectStore['getCurrentBranch'] = () =>
    Effect.succeed(DEFAULT_BRANCH as Branch);

  // TODO: Implement branching in Automerge
  const listBranches: ProjectStore['listBranches'] = () =>
    Effect.succeed([DEFAULT_BRANCH] as Branch[]);

  // TODO: Implement branching in Automerge
  const deleteBranch: ProjectStore['deleteBranch'] = () =>
    Effect.fail(
      new RepositoryError(
        'Branching is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement branching in Automerge
  const mergeAndDeleteBranch: ProjectStore['mergeAndDeleteBranch'] = () =>
    Effect.fail(
      new RepositoryError(
        'Branching is not yet supported when the app is configured with Automerge'
      )
    );

  const getMergeConflictInfo: ProjectStore['getMergeConflictInfo'] = () =>
    Effect.succeed(null);

  const abortMerge: ProjectStore['abortMerge'] = () =>
    Effect.fail(
      new RepositoryError(
        'Branching is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement multi-file conflict resolution in Automerge
  const resolveConflictByKeepingDocument: ProjectStore['resolveConflictByKeepingDocument'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Multi-file conflict resolution is not yet supported when the app is configured with Automerge'
        )
      );

  // TODO: Implement multi-file conflict resolution in Automerge
  const resolveConflictByDeletingDocument: ProjectStore['resolveConflictByDeletingDocument'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Multi-file conflict resolution is not yet supported when the app is configured with Automerge'
        )
      );

  // TODO: Implement multi-file conflict resolution in Automerge
  const commitMergeConflictsResolution: ProjectStore['commitMergeConflictsResolution'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Multi-file conflict resolution is not yet supported when the app is configured with Automerge'
        )
      );

  // TODO: Implement authorship in Automerge
  const setAuthorInfo: ProjectStore['setAuthorInfo'] = () =>
    Effect.succeed(undefined);

  // TODO: Implement explicit sync in Automerge
  const addRemoteProject: ProjectStore['addRemoteProject'] = () =>
    Effect.fail(
      new RepositoryError(
        'Explicit sync is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement explicit sync in Automerge
  const listRemoteProjects: ProjectStore['listRemoteProjects'] = () =>
    Effect.fail(
      new RepositoryError(
        'Explicit sync is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement explicit sync in Automerge
  const findRemoteProjectByName: ProjectStore['findRemoteProjectByName'] = () =>
    Effect.fail(
      new RepositoryError(
        'Explicit sync is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement explicit sync in Automerge
  const pushToRemoteProject: ProjectStore['pushToRemoteProject'] = () =>
    Effect.fail(
      new RepositoryError(
        'Explicit sync is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement explicit sync in Automerge
  const pullFromRemoteProject: ProjectStore['pullFromRemoteProject'] = () =>
    Effect.fail(
      new RepositoryError(
        'Explicit sync is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement explicit sync in Automerge
  const getRemoteBranchInfo: ProjectStore['getRemoteBranchInfo'] = () =>
    Effect.fail(
      new RepositoryError(
        'Explicit sync is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement project commit history in Automerge
  const getProjectCommitHistory: ProjectStore['getProjectCommitHistory'] = () =>
    Effect.fail(
      new RepositoryError(
        'Project commit history is not yet supported when the app is configured with Automerge'
      )
    );

  // TODO: Implement changed documents at change in Automerge
  const getChangedDocumentsAtChange: ProjectStore['getChangedDocumentsAtChange'] =
    () =>
      Effect.fail(
        new RepositoryError(
          'Changed documents at change is not yet supported when the app is configured with Automerge'
        )
      );

  // Assets aren't implemented for Automerge yet — every asset op fails
  // with a "not yet supported" RepositoryError.
  const addAssetToProject: ProjectStore['addAssetToProject'] = () =>
    Effect.fail(
      new RepositoryError(
        'Assets are not yet supported when the app is configured with Automerge'
      )
    );
  const deleteAssetFromProject: ProjectStore['deleteAssetFromProject'] = () =>
    Effect.fail(
      new RepositoryError(
        'Assets are not yet supported when the app is configured with Automerge'
      )
    );
  const lookupAssetByName: ProjectStore['lookupAssetByName'] = () =>
    Effect.fail(
      new RepositoryError(
        'Assets are not yet supported when the app is configured with Automerge'
      )
    );
  const listProjectAssets: ProjectStore['listProjectAssets'] = () =>
    Effect.fail(
      new RepositoryError(
        'Assets are not yet supported when the app is configured with Automerge'
      )
    );
  const readAssetBytes: ProjectStore['readAssetBytes'] = () =>
    Effect.fail(
      new RepositoryError(
        'Assets are not yet supported when the app is configured with Automerge'
      )
    );

  const readDocumentReferencedAssets: ProjectStore['readDocumentReferencedAssets'] =
    () => Effect.succeed([]);

  const getProjectRelativePath: ProjectStore['getProjectRelativePath'] = () =>
    Effect.fail(
      new RepositoryError(
        'Assets are not yet supported when the app is configured with Automerge'
      )
    );

  return {
    // TODO: Implement branching in Automerge
    supportsBranching: false,
    assetsDirName: DEFAULT_ASSETS_DIR_NAME,
    createProject,
    findProjectById,
    listProjectDocuments,
    addDocumentToProject,
    deleteDocumentFromProject,
    deleteDocumentsFromProject,
    renameDocumentInProject,
    renameDocumentsInProject,
    findDocumentInProject,
    addAssetToProject,
    deleteAssetFromProject,
    lookupAssetByName,
    listProjectAssets,
    readAssetBytes,
    readDocumentReferencedAssets,
    getProjectRelativePath,
    commitChanges,
    commitDocumentChanges,
    restoreDocumentChanges,
    createAndSwitchToBranch,
    switchToBranch,
    getCurrentBranch,
    listBranches,
    deleteBranch,
    mergeAndDeleteBranch,
    getMergeConflictInfo,
    abortMerge,
    resolveConflictByKeepingDocument,
    resolveConflictByDeletingDocument,
    commitMergeConflictsResolution,
    setAuthorInfo,
    addRemoteProject,
    listRemoteProjects,
    findRemoteProjectByName,
    pushToRemoteProject,
    pullFromRemoteProject,
    getRemoteBranchInfo,
    getProjectCommitHistory,
    getChangedDocumentsAtChange,
  };
};
