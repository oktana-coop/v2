import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type BrowserWindow, ipcMain } from 'electron';

import {
  type EncryptedStore,
  getValidGithubAccessToken,
} from '../../modules/auth/node';
import { buildConfig } from '../../modules/config';
import {
  type AddDocumentToMultiDocumentProjectArgs,
  type CreateMultiDocumentProjectArgs,
  createNodeAutomergeMultiDocumentProjectStoreManagerAdapter,
  createNodeAutomergeSingleDocumentProjectStoreManagerAdapter,
  createNodeGitMultiDocumentProjectStoreManagerAdapter,
  createNodeGitSingleDocumentProjectStoreManagerAdapter,
  type CreateSingleDocumentProjectArgs,
  type DeleteDocumentFromMultiDocumentProjectArgs,
  type FindDocumentInMultiDocumentProjectArgs,
  type MultiDocumentProjectCreateAndSwitchToBranchArgs,
  type MultiDocumentProjectDeleteBranchArgs,
  type MultiDocumentProjectGetCurrentBranchArgs,
  type MultiDocumentProjectListBranchesArgs,
  type MultiDocumentProjectMergeAndDeleteBranchArgs,
  type MultiDocumentProjectSetAuthorInfoArgs,
  type MultiDocumentProjectStoreManager,
  type MultiDocumentProjectSwitchToBranchArgs,
  type OpenMultiDocumentProjectByIdArgs,
  type OpenOrCreateMultiDocumentProjectArgs,
  type OpenSingleDocumentProjectStoreArgs,
  type ProjectId,
  type SetupSingleDocumentProjectStoreArgs,
  type SingleDocumentProjectCreateAndSwitchToBranchArgs,
  type SingleDocumentProjectDeleteBranchArgs,
  type SingleDocumentProjectGetCurrentBranchArgs,
  type SingleDocumentProjectListBranchesArgs,
  type SingleDocumentProjectMergeAndDeleteBranchArgs,
  type SingleDocumentProjectSetAuthorInfoArgs,
  type SingleDocumentProjectStoreManager,
  type SingleDocumentProjectSwitchToBranchArgs,
  ValidationError as VersionedProjectValidationError,
} from '../../modules/domain/project/node';
import {
  type CommitChangesArgs,
  type CreateDocumentArgs,
  DiscardUncommittedChangesArgs,
  type GetDocumentAtChangeArgs,
  type IsContentSameAtChangesArgs,
  RestoreCommitArgs,
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
  isSingleDocumentProjectVersionedStores,
  setVersionedStores,
  validateProjectIdAndGetVersionedStores,
} from '../versioned-stores';

export const registerVersionedStoresEvents = ({
  filesystem,
  rendererProcessId,
  browserWindow,
  encryptedStore,
}: {
  filesystem: Filesystem;
  rendererProcessId: string;
  browserWindow: BrowserWindow;
  encryptedStore: EncryptedStore;
}) => {
  const singleDocumentProjectStoreManager =
    buildConfig.singleDocumentProjectVersionControlSystem ===
    versionControlSystems.AUTOMERGE
      ? createNodeAutomergeSingleDocumentProjectStoreManagerAdapter({
          rendererProcessId,
          browserWindow,
        })
      : createNodeGitSingleDocumentProjectStoreManagerAdapter();

  const multiDocumentProjectStoreManager =
    buildConfig.multiDocumentProjectVersionControlSystem ===
    versionControlSystems.AUTOMERGE
      ? createNodeAutomergeMultiDocumentProjectStoreManagerAdapter({
          rendererProcessId,
          browserWindow,
        })
      : createNodeGitMultiDocumentProjectStoreManagerAdapter();

  registerStoreManagerEvents({
    singleDocumentProjectStoreManager,
    multiDocumentProjectStoreManager,
    filesystem,
  });
  registerSingleDocumentProjectStoreEvents();
  registerMultiDocumentProjectStoreEvents();
  registerVersionedDocumentStoreEvents();
  registerVersionControlSyncProvidersEvents({ encryptedStore });
};

const registerStoreManagerEvents = ({
  singleDocumentProjectStoreManager,
  multiDocumentProjectStoreManager,
  filesystem,
}: {
  singleDocumentProjectStoreManager: SingleDocumentProjectStoreManager;
  multiDocumentProjectStoreManager: MultiDocumentProjectStoreManager;
  filesystem: Filesystem;
}) => {
  ipcMain.handle(
    'create-single-document-project',
    async (_, { name, username, email }: SetupSingleDocumentProjectStoreArgs) =>
      Effect.runPromise(
        pipe(
          singleDocumentProjectStoreManager.setupSingleDocumentProjectStore({
            filesystem,
          })({ name, username, email }),
          Effect.tap(
            ({ projectId, versionedProjectStore, versionedDocumentStore }) =>
              setVersionedStores(projectId, {
                versionedProjectStore,
                versionedDocumentStore,
              })
          ),
          Effect.map(
            ({ projectId, documentId, currentBranch, file, name }) => ({
              projectId,
              documentId,
              currentBranch,
              file,
              name,
            })
          )
        )
      )
  );

  ipcMain.handle(
    'open-single-document-project',
    async (
      _,
      { fromFile, username, email }: OpenSingleDocumentProjectStoreArgs
    ) =>
      Effect.runPromise(
        pipe(
          singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
            filesystem,
          })({ fromFile, username, email }),
          Effect.tap(
            ({ projectId, versionedProjectStore, versionedDocumentStore }) =>
              setVersionedStores(projectId, {
                versionedProjectStore,
                versionedDocumentStore,
              })
          ),
          Effect.map(
            ({ projectId, documentId, currentBranch, file, name }) => ({
              projectId,
              documentId,
              currentBranch,
              file,
              name,
            })
          )
        )
      )
  );

  ipcMain.handle(
    'open-or-create-multi-document-project',
    async (_, { username, email }: OpenOrCreateMultiDocumentProjectArgs) =>
      Effect.runPromise(
        pipe(
          multiDocumentProjectStoreManager.openOrCreateMultiDocumentProject({
            filesystem,
          })({ username, email }),
          Effect.tap(
            ({ projectId, versionedProjectStore, versionedDocumentStore }) =>
              setVersionedStores(projectId, {
                versionedProjectStore,
                versionedDocumentStore,
              })
          ),
          Effect.map(({ projectId, directory, currentBranch }) => ({
            projectId,
            directory,
            currentBranch,
          }))
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
          Effect.map(({ projectId, directory, currentBranch }) => ({
            projectId,
            directory,
            currentBranch,
          }))
        )
      )
  );
};

const registerSingleDocumentProjectStoreEvents = () => {
  ipcMain.handle(
    'single-document-project-store:create-single-document-project',
    async (_, args: CreateSingleDocumentProjectArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.createSingleDocumentProject(args)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:find-document-in-project',
    async (_, id: ProjectId) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(id),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.findDocumentInProject(id)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:find-project-by-id',
    async (_, id: ProjectId) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(id),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.findProjectById(id)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:get-project-name',
    async (_, id: ProjectId) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(id),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getProjectName(id)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:create-and-switch-to-branch',
    async (_, args: SingleDocumentProjectCreateAndSwitchToBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.projectId),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.createAndSwitchToBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:switch-to-branch',
    async (_, args: SingleDocumentProjectSwitchToBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.projectId),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.switchToBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:get-current-branch',
    async (_, args: SingleDocumentProjectGetCurrentBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.projectId),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.getCurrentBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:list-branches',
    async (_, args: SingleDocumentProjectListBranchesArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.projectId),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.listBranches(args)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:delete-branch',
    async (_, args: SingleDocumentProjectDeleteBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.projectId),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.deleteBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:merge-and-delete-branch',
    async (_, args: SingleDocumentProjectMergeAndDeleteBranchArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.projectId),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.mergeAndDeleteBranch(args)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:set-author-info',
    async (_, args: SingleDocumentProjectSetAuthorInfoArgs) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(args.projectId),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.setAuthorInfo(args)
          )
        )
      )
  );

  ipcMain.handle(
    'single-document-project-store:disconnect',
    async (_, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.filterOrFail(
            isSingleDocumentProjectVersionedStores,
            () =>
              new VersionedProjectValidationError(
                `Invalid project store type. Expected a single-document project store for the given project ID.`
              )
          ),
          Effect.flatMap(({ versionedProjectStore }) =>
            versionedProjectStore.disconnect()
          )
        )
      )
  );
};

const registerMultiDocumentProjectStoreEvents = () => {
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
    async (_, id: ResolvedArtifactId, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.deleteDocument(id)
          )
        )
      )
  );

  ipcMain.handle(
    'versioned-document-store:commit-changes',
    async (_, args: CommitChangesArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.commitChanges(args)
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
    'versioned-document-store:restore-commit',
    async (_, args: RestoreCommitArgs, projectId: string) =>
      runPromiseSerializingErrorsForIPC(
        pipe(
          validateProjectIdAndGetVersionedStores(projectId),
          Effect.flatMap(({ versionedDocumentStore }) =>
            versionedDocumentStore.restoreCommit(args)
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
