import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type BrowserWindow, ipcMain } from 'electron';

import {
  type EncryptedStore,
  getValidGithubAccessToken,
} from '../../modules/auth/node';
import { buildConfig } from '../../modules/config';
import {
  type AddAssetToProjectArgs,
  type AddDocumentToProjectArgs,
  createNodeAutomergeProjectStoreManagerAdapter,
  createNodeGitProjectStoreManagerAdapter,
  type CreateProjectArgs,
  type DeleteDocumentFromProjectArgs,
  type DeleteDocumentsFromProjectArgs,
  type FindDocumentInProjectArgs,
  type GetProjectRelativePathArgs,
  type LookupAssetByNameInProjectArgs,
  type OpenOrCreateProjectArgs,
  type OpenProjectByIdArgs,
  type ProjectAbortMergeArgs,
  type ProjectAddRemoteProjectArgs,
  type ProjectCommitChangesArgs,
  type ProjectCommitDocumentChangesArgs,
  type ProjectCommitMergeConflictsResolutionArgs,
  type ProjectCreateAndSwitchToBranchArgs,
  type ProjectDeleteBranchArgs,
  type ProjectFindRemoteProjectByNameArgs,
  type ProjectGetChangedDocumentsAtChangeArgs,
  type ProjectGetCurrentBranchArgs,
  type ProjectGetMergeConflictInfoArgs,
  type ProjectGetProjectCommitHistoryArgs,
  type ProjectGetRemoteBranchInfoArgs,
  type ProjectId,
  type ProjectListBranchesArgs,
  type ProjectListRemoteProjectsArgs,
  type ProjectMergeAndDeleteBranchArgs,
  type ProjectPullFromRemoteProjectArgs,
  type ProjectPushToRemoteProjectArgs,
  type ProjectResolveConflictByDeletingDocumentArgs,
  type ProjectResolveConflictByKeepingDocumentArgs,
  type ProjectRestoreDocumentChangesArgs,
  type ProjectSetAuthorInfoArgs,
  type ProjectStoreManager,
  type ProjectSwitchToBranchArgs,
  type ReadDocumentReferencedAssetsFromProjectArgs,
  type RenameDocumentInProjectArgs,
  type RenameDocumentsInProjectArgs,
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
  const projectStoreManager =
    buildConfig.projectVersionControlSystem === versionControlSystems.AUTOMERGE
      ? createNodeAutomergeProjectStoreManagerAdapter({
          rendererProcessId,
          browserWindow,
        })
      : createNodeGitProjectStoreManagerAdapter({
          documentAnalyzer,
        });

  registerStoreManagerEvents({
    projectStoreManager,
    filesystem,
    encryptedStore,
  });
  registerProjectStoreEvents({ encryptedStore });
  registerVersionedDocumentStoreEvents();
  registerVersionControlSyncProvidersEvents({ encryptedStore });
};

const registerStoreManagerEvents = ({
  projectStoreManager,
  filesystem,
  encryptedStore,
}: {
  projectStoreManager: ProjectStoreManager;
  filesystem: Filesystem;
  encryptedStore: EncryptedStore;
}) => {
  ipcMain.handle(
    'open-or-create-project',
    async (_, { username, email, cloneUrl }: OpenOrCreateProjectArgs) =>
      Effect.runPromise(
        pipe(
          cloneUrl
            ? pipe(
                getValidGithubAccessToken({ encryptedStore })(),
                Effect.flatMap((userToken) =>
                  projectStoreManager.openOrCreateProject({
                    filesystem,
                  })({ username, email, cloneUrl, authToken: userToken })
                )
              )
            : projectStoreManager.openOrCreateProject({
                filesystem,
              })({ username, email }),
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
    'open-project-by-id',
    async (
      _,
      { projectId, directoryPath, username, email }: OpenProjectByIdArgs
    ) =>
      Effect.runPromise(
        pipe(
          projectStoreManager.openProjectById({
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

const registerProjectStoreEvents = ({
  encryptedStore,
}: {
  encryptedStore: EncryptedStore;
}) => {
  ipcMain.handle(
    'project-store:create-project',
    async (_, args: CreateProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.path),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.createProject(args)
          )
        )
      )
  );

  ipcMain.handle('project-store:find-project-by-id', async (_, id: ProjectId) =>
    runPromiseSerializingErrorsForIPC(
      pipe(
        getVersionedStores(id),
        Effect.flatMap(({ versionedProjectStore }) =>
          versionedProjectStore.findProjectById(id)
        )
      )
    )
  );

  ipcMain.handle(
    'project-store:list-project-documents',
    async (_, id: ProjectId) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(id),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.listProjectDocuments(id)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:add-document-to-project',
    async (_, args: AddDocumentToProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.addDocumentToProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:delete-document-from-project',
    async (_, args: DeleteDocumentFromProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.deleteDocumentFromProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:delete-documents-from-project',
    async (_, args: DeleteDocumentsFromProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.deleteDocumentsFromProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:rename-document-in-project',
    async (_, args: RenameDocumentInProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.renameDocumentInProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:rename-documents-in-project',
    async (_, args: RenameDocumentsInProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.renameDocumentsInProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:find-document-in-project',
    async (_, args: FindDocumentInProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.findDocumentInProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:add-asset-to-project',
    async (_, args: AddAssetToProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.addAssetToProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:lookup-asset-by-name',
    async (_, args: LookupAssetByNameInProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.lookupAssetByName(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:get-project-relative-path',
    async (_, args: GetProjectRelativePathArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getProjectRelativePath(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:read-document-referenced-assets',
    async (_, args: ReadDocumentReferencedAssetsFromProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.readDocumentReferencedAssets(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:commit-changes',
    async (_, args: ProjectCommitChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.commitChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:commit-document-changes',
    async (_, args: ProjectCommitDocumentChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.commitDocumentChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:restore-document-changes',
    async (_, args: ProjectRestoreDocumentChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.restoreDocumentChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:create-and-switch-to-branch',
    async (_, args: ProjectCreateAndSwitchToBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.createAndSwitchToBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:switch-to-branch',
    async (_, args: ProjectSwitchToBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.switchToBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:get-current-branch',
    async (_, args: ProjectGetCurrentBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getCurrentBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:list-branches',
    async (_, args: ProjectListBranchesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.listBranches(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:delete-branch',
    async (_, args: ProjectDeleteBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.deleteBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:merge-and-delete-branch',
    async (_, args: ProjectMergeAndDeleteBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.mergeAndDeleteBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:get-merge-conflict-info',
    async (_, args: ProjectGetMergeConflictInfoArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getMergeConflictInfo(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:abort-merge',
    async (_, args: ProjectAbortMergeArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.abortMerge(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:commit-merge-conflicts-resolution',
    async (_, args: ProjectCommitMergeConflictsResolutionArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.commitMergeConflictsResolution(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:resolve-conflict-by-keeping-document',
    async (_, args: ProjectResolveConflictByKeepingDocumentArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.resolveConflictByKeepingDocument(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:resolve-conflict-by-deleting-document',
    async (_, args: ProjectResolveConflictByDeletingDocumentArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.resolveConflictByDeletingDocument(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:set-author-info',
    async (_, args: ProjectSetAuthorInfoArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.setAuthorInfo(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:add-remote-project',
    async (_, args: ProjectAddRemoteProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
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
    'project-store:list-remote-projects',
    async (_, args: ProjectListRemoteProjectsArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.listRemoteProjects(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:find-remote-project-by-name',
    async (_, args: ProjectFindRemoteProjectByNameArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.findRemoteProjectByName(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:push-to-remote-project',
    async (_, args: ProjectPushToRemoteProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
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
    'project-store:pull-from-remote-project',
    async (_, args: ProjectPullFromRemoteProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
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
    'project-store:get-remote-branch-info',
    async (_, args: ProjectGetRemoteBranchInfoArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
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
    'project-store:get-project-commit-history',
    async (_, args: ProjectGetProjectCommitHistoryArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getProjectCommitHistory(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:get-changed-documents-at-change',
    async (_, args: ProjectGetChangedDocumentsAtChangeArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getVersionedStores(args.projectId),
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
