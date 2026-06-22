import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type BrowserWindow, ipcMain } from 'electron';

import {
  type EncryptedStore,
  getValidGithubAccessToken,
} from '../../modules/auth/node';
import { buildConfig } from '../../modules/config';
import {
  type AddAssetToMultiDocumentProjectArgs,
  type AddDocumentToMultiDocumentProjectArgs,
  type CreateMultiDocumentProjectArgs,
  createNodeAutomergeMultiDocumentProjectStoreManagerAdapter,
  createNodeGitMultiDocumentProjectStoreManagerAdapter,
  type DeleteDocumentFromMultiDocumentProjectArgs,
  type DeleteDocumentsFromMultiDocumentProjectArgs,
  type FindDocumentInMultiDocumentProjectArgs,
  type GetProjectRelativePathArgs,
  type LookupAssetByNameInMultiDocumentProjectArgs,
  type MultiDocumentProjectAbortMergeArgs,
  type MultiDocumentProjectAddRemoteProjectArgs,
  type MultiDocumentProjectCommitChangesArgs,
  type MultiDocumentProjectCommitDocumentChangesArgs,
  type MultiDocumentProjectCommitMergeConflictsResolutionArgs,
  type MultiDocumentProjectCreateAndSwitchToBranchArgs,
  type MultiDocumentProjectDeleteBranchArgs,
  type MultiDocumentProjectFindRemoteProjectByNameArgs,
  type MultiDocumentProjectGetChangedDocumentsAtChangeArgs,
  type MultiDocumentProjectGetCurrentBranchArgs,
  type MultiDocumentProjectGetMergeConflictInfoArgs,
  type MultiDocumentProjectGetProjectCommitHistoryArgs,
  type MultiDocumentProjectGetRemoteBranchInfoArgs,
  type MultiDocumentProjectListBranchesArgs,
  type MultiDocumentProjectListRemoteProjectsArgs,
  type MultiDocumentProjectMergeAndDeleteBranchArgs,
  type MultiDocumentProjectPullFromRemoteProjectArgs,
  type MultiDocumentProjectPushToRemoteProjectArgs,
  type MultiDocumentProjectResolveConflictByDeletingDocumentArgs,
  type MultiDocumentProjectResolveConflictByKeepingDocumentArgs,
  type MultiDocumentProjectRestoreDocumentChangesArgs,
  type MultiDocumentProjectSetAuthorInfoArgs,
  type MultiDocumentProjectStoreManager,
  type MultiDocumentProjectSwitchToBranchArgs,
  type OpenMultiDocumentProjectByIdArgs,
  type OpenOrCreateMultiDocumentProjectArgs,
  type ProjectId,
  type ReadDocumentReferencedAssetsFromMultiDocumentProjectArgs,
  type RenameDocumentInMultiDocumentProjectArgs,
  type RenameDocumentsInMultiDocumentProjectArgs,
  ValidationError as VersionedProjectValidationError,
} from '../../modules/domain/project/node';
import {
  type CreateDocumentArgs,
  type DeleteDocumentArgs,
  DiscardUncommittedChangesArgs,
  type DocumentAnalyzer,
  type GetDocumentAtChangeArgs,
  type IsContentSameAtChangesArgs,
  type UpdateRichTextDocumentContentArgs,
} from '../../modules/domain/rich-text';
import { runPromiseSerializingErrorsForIPC } from '../../modules/infrastructure/cross-platform';
import { Filesystem } from '../../modules/infrastructure/filesystem';
import {
  getGithubUserRepositories,
  type ResolvedArtifactId,
  versionControlSystems,
} from '../../modules/infrastructure/version-control';
import {
  getVersionedStores,
  isMultiDocumentProjectVersionedStores,
  setVersionedStores,
  validateProjectIdAndGetVersionedStores,
} from '../versioned-stores';

export const registerVersionedStoresEvents = ({
  filesystem,
  documentAnalyzer,
  rendererProcessId,
  browserWindow,
  encryptedStore,
}: {
  filesystem: Filesystem;
  documentAnalyzer: DocumentAnalyzer;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  encryptedStore: EncryptedStore;
}) => {
  const multiDocumentProjectStoreManager =
    buildConfig.multiDocumentProjectVersionControlSystem ===
    versionControlSystems.AUTOMERGE
      ? createNodeAutomergeMultiDocumentProjectStoreManagerAdapter({
          rendererProcessId,
          browserWindow,
        })
      : createNodeGitMultiDocumentProjectStoreManagerAdapter({
          documentAnalyzer,
        });

  registerStoreManagerEvents({
    multiDocumentProjectStoreManager,
    filesystem,
    encryptedStore,
  });
  registerMultiDocumentProjectStoreEvents({ encryptedStore });
  registerVersionedDocumentStoreEvents();
  registerVersionControlSyncProvidersEvents({ encryptedStore });
};

const registerStoreManagerEvents = ({
  multiDocumentProjectStoreManager,
  filesystem,
  encryptedStore,
}: {
  multiDocumentProjectStoreManager: MultiDocumentProjectStoreManager;
  filesystem: Filesystem;
  encryptedStore: EncryptedStore;
}) => {
  ipcMain.handle(
    'open-or-create-multi-document-project',
    async (
      _,
      { username, email, cloneUrl }: OpenOrCreateMultiDocumentProjectArgs
    ) =>
      Effect.runPromise(
        pipe(
          cloneUrl
            ? pipe(
                getValidGithubAccessToken({ encryptedStore })(),
                Effect.flatMap((userToken) =>
                  multiDocumentProjectStoreManager.openOrCreateMultiDocumentProject(
                    {
                      filesystem,
                    }
                  )({ username, email, cloneUrl, authToken: userToken })
                )
              )
            : multiDocumentProjectStoreManager.openOrCreateMultiDocumentProject(
                {
                  filesystem,
                }
              )({ username, email }),
          Effect.tap(
            ({ projectId, versionedProjectStore, versionedDocumentStore }) =>
              setVersionedStores(projectId, {
                versionedProjectStore,
                versionedDocumentStore,
              })
          ),
          Effect.map(
            ({
              projectId,
              directory,
              currentBranch,
              mergeConflictInfo,
              remoteProjects,
            }) => ({
              projectId,
              directory,
              currentBranch,
              mergeConflictInfo,
              remoteProjects,
            })
          )
        )
      )
  );

  ipcMain.handle(
    'open-multi-document-project-by-id',
    async (
      _,
      {
        projectId,
        directoryPath,
        username,
        email,
      }: OpenMultiDocumentProjectByIdArgs
    ) =>
      Effect.runPromise(
        pipe(
          multiDocumentProjectStoreManager.openMultiDocumentProjectById({
            filesystem,
          })({ projectId, directoryPath, username, email }),
          Effect.tap(
            ({ projectId, versionedProjectStore, versionedDocumentStore }) =>
              setVersionedStores(projectId, {
                versionedProjectStore,
                versionedDocumentStore,
              })
          ),
          Effect.map(
            ({
              projectId,
              directory,
              currentBranch,
              mergeConflictInfo,
              remoteProjects,
            }) => ({
              projectId,
              directory,
              currentBranch,
              mergeConflictInfo,
              remoteProjects,
            })
          )
        )
      )
  );
};

const registerMultiDocumentProjectStoreEvents = ({
  encryptedStore,
}: {
  encryptedStore: EncryptedStore;
}) => {
  ipcMain.handle(
    'multi-document-project-store:create-project',
    async (_, args: CreateMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.path),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.createProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:find-project-by-id',
    async (_, id: ProjectId) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(id),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.findProjectById(id)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:list-project-documents',
    async (_, id: ProjectId) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(id),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.listProjectDocuments(id)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:add-document-to-project',
    async (_, args: AddDocumentToMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.addDocumentToProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:delete-document-from-project',
    async (_, args: DeleteDocumentFromMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.deleteDocumentFromProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:delete-documents-from-project',
    async (_, args: DeleteDocumentsFromMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.deleteDocumentsFromProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:rename-document-in-project',
    async (_, args: RenameDocumentInMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.renameDocumentInProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:rename-documents-in-project',
    async (_, args: RenameDocumentsInMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.renameDocumentsInProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:find-document-in-project',
    async (_, args: FindDocumentInMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.findDocumentInProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:add-asset-to-project',
    async (_, args: AddAssetToMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.addAssetToProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:lookup-asset-by-name',
    async (_, args: LookupAssetByNameInMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.lookupAssetByName(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:get-project-relative-path',
    async (_, args: GetProjectRelativePathArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getProjectRelativePath(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:read-document-referenced-assets',
    async (_, args: ReadDocumentReferencedAssetsFromMultiDocumentProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.readDocumentReferencedAssets(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:commit-changes',
    async (_, args: MultiDocumentProjectCommitChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.commitChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:commit-document-changes',
    async (_, args: MultiDocumentProjectCommitDocumentChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.commitDocumentChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:restore-document-changes',
    async (_, args: MultiDocumentProjectRestoreDocumentChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.restoreDocumentChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:create-and-switch-to-branch',
    async (_, args: MultiDocumentProjectCreateAndSwitchToBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.createAndSwitchToBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:switch-to-branch',
    async (_, args: MultiDocumentProjectSwitchToBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.switchToBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:get-current-branch',
    async (_, args: MultiDocumentProjectGetCurrentBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getCurrentBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:list-branches',
    async (_, args: MultiDocumentProjectListBranchesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.listBranches(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:delete-branch',
    async (_, args: MultiDocumentProjectDeleteBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.deleteBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:merge-and-delete-branch',
    async (_, args: MultiDocumentProjectMergeAndDeleteBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.mergeAndDeleteBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:get-merge-conflict-info',
    async (_, args: MultiDocumentProjectGetMergeConflictInfoArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getMergeConflictInfo(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:abort-merge',
    async (_, args: MultiDocumentProjectAbortMergeArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.abortMerge(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:commit-merge-conflicts-resolution',
    async (_, args: MultiDocumentProjectCommitMergeConflictsResolutionArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.commitMergeConflictsResolution(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:resolve-conflict-by-keeping-document',
    async (_, args: MultiDocumentProjectResolveConflictByKeepingDocumentArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.resolveConflictByKeepingDocument(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:resolve-conflict-by-deleting-document',
    async (
      _,
      args: MultiDocumentProjectResolveConflictByDeletingDocumentArgs
    ) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.resolveConflictByDeletingDocument(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:set-author-info',
    async (_, args: MultiDocumentProjectSetAuthorInfoArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.setAuthorInfo(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:add-remote-project',
    async (_, args: MultiDocumentProjectAddRemoteProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            pipe(
              getValidGithubAccessToken({ encryptedStore })(),
              Effect.flatMap((userToken) =>
                versionedProjectStore.addRemoteProject({
                  ...args,
                  authToken: userToken,
                })
              )
            )
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:list-remote-projects',
    async (_, args: MultiDocumentProjectListRemoteProjectsArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.listRemoteProjects(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:find-remote-project-by-name',
    async (_, args: MultiDocumentProjectFindRemoteProjectByNameArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.findRemoteProjectByName(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:push-to-remote-project',
    async (_, args: MultiDocumentProjectPushToRemoteProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            pipe(
              getValidGithubAccessToken({ encryptedStore })(),
              Effect.flatMap((userToken) =>
                versionedProjectStore.pushToRemoteProject({
                  ...args,
                  authToken: userToken,
                })
              )
            )
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:pull-from-remote-project',
    async (_, args: MultiDocumentProjectPullFromRemoteProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            pipe(
              getValidGithubAccessToken({ encryptedStore })(),
              Effect.flatMap((userToken) =>
                versionedProjectStore.pullFromRemoteProject({
                  ...args,
                  authToken: userToken,
                })
              )
            )
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:get-remote-branch-info',
    async (_, args: MultiDocumentProjectGetRemoteBranchInfoArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            pipe(
              getValidGithubAccessToken({ encryptedStore })(),
              Effect.flatMap((userToken) =>
                versionedProjectStore.getRemoteBranchInfo({
                  ...args,
                  authToken: userToken,
                })
              )
            )
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:get-project-commit-history',
    async (_, args: MultiDocumentProjectGetProjectCommitHistoryArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getProjectCommitHistory(args)
          )
        )
      )
  );

  ipcMain.handle(
    'multi-document-project-store:get-changed-documents-at-change',
    async (_, args: MultiDocumentProjectGetChangedDocumentsAtChangeArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.filterOrFail(
            isMultiDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a multi-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getChangedDocumentsAtChange(args)
          )
        )
      )
  );
};

const registerVersionedDocumentStoreEvents = () => {
  ipcMain.handle(
    'versioned-document-store:set-project-id',
    async (_, id: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(id),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.setProjectId(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:create-document',
    async (_, args: CreateDocumentArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.createDocument(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:find-document-by-id',
    async (_, id: ResolvedArtifactId, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.findDocumentById(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:get-document-last-change-id',
    async (_, id: ResolvedArtifactId, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.getDocumentLastChangeId(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:update-rich-text-document-content',
    async (_, args: UpdateRichTextDocumentContentArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.updateRichTextDocumentContent(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:delete-document',
    async (_, args: DeleteDocumentArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.deleteDocument(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:get-document-history',
    async (_, id: ResolvedArtifactId, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.getDocumentHistory(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:get-document-at-change',
    async (_, args: GetDocumentAtChangeArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.getDocumentAtChange(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:is-content-same-at-changes',
    async (_, args: IsContentSameAtChangesArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.isContentSameAtChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:discard-uncommitted-changes',
    async (_, args: DiscardUncommittedChangesArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.discardUncommittedChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:resolve-content-conflict',
    async (_, args: DiscardUncommittedChangesArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.resolveContentConflict(args)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:disconnect',
    async (_, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.disconnect()
          )
        )
      )
  );
};

const registerVersionControlSyncProvidersEvents = ({
  encryptedStore,
}: {
  encryptedStore: EncryptedStore;
}) => {
  ipcMain.handle(
    'version-control-sync-providers:get-github-user-repositories',
    async () =>
      Effect.runPromise(
        pipe(
          getValidGithubAccessToken({ encryptedStore })(),
          Effect.flatMap((userToken) => getGithubUserRepositories(userToken))
        )
      )
  );
};
