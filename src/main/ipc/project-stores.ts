import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { ipcMain } from 'electron';

import {
  type EncryptedStore,
  getValidGithubAccessToken,
} from '../../modules/auth/node';
import {
  type AddAssetToProjectArgs,
  type CreateDirectoryArgs,
  type CreateDocumentArgs,
  createNodeGitProjectStoreManagerAdapter,
  type CreateProjectArgs,
  type DeleteDirectoryArgs,
  type DeleteDocumentArgs,
  type DeleteDocumentsArgs,
  type DiscardUncommittedChangesArgs,
  type FindDocumentByIdArgs,
  type GetArtifactMetaDataByIdArgs,
  type GetDocumentAtChangeArgs,
  type GetDocumentHistoryArgs,
  type GetDocumentLastChangeIdArgs,
  type GetProjectRelativePathArgs,
  type IsContentSameAtChangesArgs,
  type LookupArtifactByPathArgs,
  type LookupAssetByNameInProjectArgs,
  type LookupDocumentInProjectArgs,
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
  type RenameDirectoryArgs,
  type RenameDocumentInProjectArgs,
  type ResolveContentConflictArgs,
  type UpdateRichTextDocumentContentArgs,
} from '../../modules/domain/project/node';
import { type DocumentAnalyzer } from '../../modules/domain/rich-text';
import { runPromiseSerializingErrorsForIPC } from '../../modules/infrastructure/cross-platform';
import { Filesystem } from '../../modules/infrastructure/filesystem';
import { getGithubUserRepositories } from '../../modules/infrastructure/version-control';
import {
  getProjectStore,
  setProjectStore,
  validateProjectIdAndGetProjectStore,
} from '../project-stores';

export const registerProjectStoresEvents = ({
  filesystem,
  documentAnalyzer,
  encryptedStore,
}: {
  filesystem: Filesystem;
  documentAnalyzer: DocumentAnalyzer;
  encryptedStore: EncryptedStore;
}) => {
  const projectStoreManager = createNodeGitProjectStoreManagerAdapter({
    documentAnalyzer,
  });

  registerStoreManagerEvents({
    projectStoreManager,
    filesystem,
    encryptedStore,
  });
  registerProjectStoreEvents({ encryptedStore });
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
          Effect.tap(({ projectId, projectStore }) =>
            setProjectStore(projectId, projectStore)
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
          Effect.tap(({ projectId, projectStore }) =>
            setProjectStore(projectId, projectStore)
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
          validateProjectIdAndGetProjectStore(args.path),
          Effect.flatMap((projectStore) => projectStore.createProject(args))
        )
      )
  );

  ipcMain.handle('project-store:find-project-by-id', async (_, id: ProjectId) =>
    runPromiseSerializingErrorsForIPC(
      pipe(
        getProjectStore(id),
        Effect.flatMap((projectStore) => projectStore.findProjectById(id))
      )
    )
  );

  ipcMain.handle(
    'project-store:list-project-documents',
    async (_, id: ProjectId) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(id),
          Effect.flatMap((projectStore) =>
            projectStore.listProjectDocuments(id)
          )
        )
      )
  );

  ipcMain.handle('project-store:get-project-tree', async (_, id: ProjectId) =>
    runPromiseSerializingErrorsForIPC(
      pipe(
        getProjectStore(id),
        Effect.flatMap((projectStore) => projectStore.getProjectTree(id))
      )
    )
  );

  ipcMain.handle(
    'project-store:create-directory',
    async (_, args: CreateDirectoryArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.createDirectory(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:delete-directory',
    async (_, args: DeleteDirectoryArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.deleteDirectory(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:get-artifact-metadata-by-id',
    async (_, args: GetArtifactMetaDataByIdArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.getArtifactMetaDataById(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:lookup-artifact-by-path',
    async (_, args: LookupArtifactByPathArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.lookupArtifactByPath(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:delete-documents',
    async (_, args: DeleteDocumentsArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.deleteDocuments(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:rename-document-in-project',
    async (_, args: RenameDocumentInProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.renameDocumentInProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:rename-directory',
    async (_, args: RenameDirectoryArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.renameDirectory(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:lookup-document-in-project',
    async (_, args: LookupDocumentInProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.lookupDocumentInProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:find-document-by-path',
    async (_, args: LookupDocumentInProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.findDocumentByPath(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:add-asset-to-project',
    async (_, args: AddAssetToProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.addAssetToProject(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:lookup-asset-by-name',
    async (_, args: LookupAssetByNameInProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.lookupAssetByName(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:get-project-relative-path',
    async (_, args: GetProjectRelativePathArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.getProjectRelativePath(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:read-document-referenced-assets',
    async (_, args: ReadDocumentReferencedAssetsFromProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.readDocumentReferencedAssets(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:commit-changes',
    async (_, args: ProjectCommitChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.commitChanges(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:commit-document-changes',
    async (_, args: ProjectCommitDocumentChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.commitDocumentChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:restore-document-changes',
    async (_, args: ProjectRestoreDocumentChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.restoreDocumentChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:create-and-switch-to-branch',
    async (_, args: ProjectCreateAndSwitchToBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.createAndSwitchToBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:switch-to-branch',
    async (_, args: ProjectSwitchToBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.switchToBranch(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:get-current-branch',
    async (_, args: ProjectGetCurrentBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.getCurrentBranch(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:list-branches',
    async (_, args: ProjectListBranchesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.listBranches(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:delete-branch',
    async (_, args: ProjectDeleteBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.deleteBranch(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:merge-and-delete-branch',
    async (_, args: ProjectMergeAndDeleteBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.mergeAndDeleteBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:get-merge-conflict-info',
    async (_, args: ProjectGetMergeConflictInfoArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.getMergeConflictInfo(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:abort-merge',
    async (_, args: ProjectAbortMergeArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.abortMerge(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:commit-merge-conflicts-resolution',
    async (_, args: ProjectCommitMergeConflictsResolutionArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.commitMergeConflictsResolution(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:resolve-conflict-by-keeping-document',
    async (_, args: ProjectResolveConflictByKeepingDocumentArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.resolveConflictByKeepingDocument(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:resolve-conflict-by-deleting-document',
    async (_, args: ProjectResolveConflictByDeletingDocumentArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.resolveConflictByDeletingDocument(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:set-author-info',
    async (_, args: ProjectSetAuthorInfoArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.setAuthorInfo(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:add-remote-project',
    async (_, args: ProjectAddRemoteProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            pipe(
              getValidGithubAccessToken({ encryptedStore })(),
              Effect.flatMap((userToken) =>
                projectStore.addRemoteProject({
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
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.listRemoteProjects(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:find-remote-project-by-name',
    async (_, args: ProjectFindRemoteProjectByNameArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.findRemoteProjectByName(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:push-to-remote-project',
    async (_, args: ProjectPushToRemoteProjectArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            pipe(
              getValidGithubAccessToken({ encryptedStore })(),
              Effect.flatMap((userToken) =>
                projectStore.pushToRemoteProject({
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
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            pipe(
              getValidGithubAccessToken({ encryptedStore })(),
              Effect.flatMap((userToken) =>
                projectStore.pullFromRemoteProject({
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
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            pipe(
              getValidGithubAccessToken({ encryptedStore })(),
              Effect.flatMap((userToken) =>
                projectStore.getRemoteBranchInfo({
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
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.getProjectCommitHistory(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:get-changed-documents-at-change',
    async (_, args: ProjectGetChangedDocumentsAtChangeArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          getProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.getChangedDocumentsAtChange(args)
          )
        )
      )
  );
  ipcMain.handle(
    'project-store:create-document',
    async (_, args: CreateDocumentArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.createDocument(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:find-document-by-id',
    async (_, args: FindDocumentByIdArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.findDocumentById(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:get-document-last-change-id',
    async (_, args: GetDocumentLastChangeIdArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.getDocumentLastChangeId(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:update-rich-text-document-content',
    async (_, args: UpdateRichTextDocumentContentArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.updateRichTextDocumentContent(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:delete-document',
    async (_, args: DeleteDocumentArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) => projectStore.deleteDocument(args))
        )
      )
  );

  ipcMain.handle(
    'project-store:get-document-history',
    async (_, args: GetDocumentHistoryArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.getDocumentHistory(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:get-document-at-change',
    async (_, args: GetDocumentAtChangeArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.getDocumentAtChange(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:is-content-same-at-changes',
    async (_, args: IsContentSameAtChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.isContentSameAtChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:discard-uncommitted-changes',
    async (_, args: DiscardUncommittedChangesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.discardUncommittedChanges(args)
          )
        )
      )
  );

  ipcMain.handle(
    'project-store:resolve-content-conflict',
    async (_, args: ResolveContentConflictArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetProjectStore(args.projectId),
          Effect.flatMap((projectStore) =>
            projectStore.resolveContentConflict(args)
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
