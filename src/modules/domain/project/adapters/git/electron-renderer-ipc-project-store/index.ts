import {
  effectifyIPCPromise,
  type ErrorRegistry,
} from '../../../../../../modules/infrastructure/cross-platform';
import {
  AlreadyExistsError,
  FilesystemAlreadyExistsErrorTag,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  MergeConflictError,
  MigrationError,
  VersionControlMergeConflictErrorTag,
  VersionControlMigrationErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { type EffectErrorType } from '../../../../../../utils/effect';
import { DEFAULT_ASSETS_DIR_NAME } from '../../../constants';
import {
  DeletedDocumentError,
  NotFoundError,
  RepositoryError,
  ValidationError,
  VersionedProjectDeletedDocumentErrorTag,
  VersionedProjectNotFoundErrorTag,
  VersionedProjectRepositoryErrorTag,
  VersionedProjectValidationErrorTag,
} from '../../../errors';
import { ProjectStore } from '../../../ports';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (): ProjectStore => ({
  supportsBranching: true,
  assetsDirName: DEFAULT_ASSETS_DIR_NAME,
  getArtifactMetaDataById: (
    ...args: Parameters<ProjectStore['getArtifactMetaDataById']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getArtifactMetaDataById']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getArtifactMetaDataById(...args)),
  lookupArtifactByPath: (
    ...args: Parameters<ProjectStore['lookupArtifactByPath']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['lookupArtifactByPath']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.lookupArtifactByPath(...args)),
  createProject: (...args: Parameters<ProjectStore['createProject']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['createProject']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.createProject(...args)),
  findProjectById: (...args: Parameters<ProjectStore['findProjectById']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['findProjectById']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.findProjectById(...args)),
  listProjectDocuments: (
    ...args: Parameters<ProjectStore['listProjectDocuments']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['listProjectDocuments']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.listProjectDocuments(...args)),
  getProjectTree: (...args: Parameters<ProjectStore['getProjectTree']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getProjectTree']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getProjectTree(...args)),
  deleteDocuments: (...args: Parameters<ProjectStore['deleteDocuments']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['deleteDocuments']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.deleteDocuments(...args)),
  renameDocumentInProject: (
    ...args: Parameters<ProjectStore['renameDocumentInProject']>
  ) =>
    effectifyIPCPromise(
      {
        [FilesystemAlreadyExistsErrorTag]: AlreadyExistsError,
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['renameDocumentInProject']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.renameDocumentInProject(...args)),
  renameDirectory: (...args: Parameters<ProjectStore['renameDirectory']>) =>
    effectifyIPCPromise(
      {
        [FilesystemAlreadyExistsErrorTag]: AlreadyExistsError,
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['renameDirectory']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.renameDirectory(...args)),
  lookupDocumentInProject: (
    ...args: Parameters<ProjectStore['lookupDocumentInProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['lookupDocumentInProject']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.lookupDocumentInProject(...args)),
  findDocumentByPath: (
    ...args: Parameters<ProjectStore['findDocumentByPath']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['findDocumentByPath']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.findDocumentByPath(...args)),
  addAssetToProject: (...args: Parameters<ProjectStore['addAssetToProject']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['addAssetToProject']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.addAssetToProject(...args)),
  deleteAssetFromProject: (
    ...args: Parameters<ProjectStore['deleteAssetFromProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['deleteAssetFromProject']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.deleteAssetFromProject(...args)),
  lookupAssetByName: (...args: Parameters<ProjectStore['lookupAssetByName']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['lookupAssetByName']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.lookupAssetByName(...args)),
  listProjectAssets: (...args: Parameters<ProjectStore['listProjectAssets']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['listProjectAssets']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.listProjectAssets(...args)),
  readAssetBytes: (...args: Parameters<ProjectStore['readAssetBytes']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['readAssetBytes']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.readAssetBytes(...args)),
  readDocumentReferencedAssets: (
    ...args: Parameters<ProjectStore['readDocumentReferencedAssets']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<ProjectStore['readDocumentReferencedAssets']>
        >
      >,
      RepositoryError
    )(window.projectStoreAPI.readDocumentReferencedAssets(...args)),
  getProjectRelativePath: (
    ...args: Parameters<ProjectStore['getProjectRelativePath']>
  ) =>
    effectifyIPCPromise(
      {} as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getProjectRelativePath']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getProjectRelativePath(...args)),
  commitChanges: (...args: Parameters<ProjectStore['commitChanges']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['commitChanges']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.commitChanges(...args)),
  commitDocumentChanges: (
    ...args: Parameters<ProjectStore['commitDocumentChanges']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['commitDocumentChanges']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.commitDocumentChanges(...args)),
  restoreDocumentChanges: (
    ...args: Parameters<ProjectStore['restoreDocumentChanges']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['restoreDocumentChanges']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.restoreDocumentChanges(...args)),
  createAndSwitchToBranch: (
    ...args: Parameters<ProjectStore['createAndSwitchToBranch']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['createAndSwitchToBranch']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.createAndSwitchToBranch(...args)),
  switchToBranch: (...args: Parameters<ProjectStore['switchToBranch']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['switchToBranch']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.switchToBranch(...args)),
  getCurrentBranch: (...args: Parameters<ProjectStore['getCurrentBranch']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getCurrentBranch']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getCurrentBranch(...args)),
  listBranches: (...args: Parameters<ProjectStore['listBranches']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['listBranches']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.listBranches(...args)),
  deleteBranch: (...args: Parameters<ProjectStore['deleteBranch']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['deleteBranch']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.deleteBranch(...args)),
  mergeAndDeleteBranch: (
    ...args: Parameters<ProjectStore['mergeAndDeleteBranch']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMergeConflictErrorTag]: MergeConflictError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['mergeAndDeleteBranch']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.mergeAndDeleteBranch(...args)),
  getMergeConflictInfo: (
    ...args: Parameters<ProjectStore['getMergeConflictInfo']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getMergeConflictInfo']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getMergeConflictInfo(...args)),
  abortMerge: (...args: Parameters<ProjectStore['abortMerge']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['abortMerge']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.abortMerge(...args)),
  resolveConflictByKeepingDocument: (
    ...args: Parameters<ProjectStore['resolveConflictByKeepingDocument']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<ProjectStore['resolveConflictByKeepingDocument']>
        >
      >,
      RepositoryError
    )(window.projectStoreAPI.resolveConflictByKeepingDocument(...args)),
  resolveConflictByDeletingDocument: (
    ...args: Parameters<ProjectStore['resolveConflictByDeletingDocument']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<ProjectStore['resolveConflictByDeletingDocument']>
        >
      >,
      RepositoryError
    )(window.projectStoreAPI.resolveConflictByDeletingDocument(...args)),
  commitMergeConflictsResolution: (
    ...args: Parameters<ProjectStore['commitMergeConflictsResolution']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<ProjectStore['commitMergeConflictsResolution']>
        >
      >,
      RepositoryError
    )(window.projectStoreAPI.commitMergeConflictsResolution(...args)),
  setAuthorInfo: (...args: Parameters<ProjectStore['setAuthorInfo']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['setAuthorInfo']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.setAuthorInfo(...args)),
  addRemoteProject: (...args: Parameters<ProjectStore['addRemoteProject']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['addRemoteProject']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.addRemoteProject(...args)),
  listRemoteProjects: (
    ...args: Parameters<ProjectStore['listRemoteProjects']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['listRemoteProjects']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.listRemoteProjects(...args)),
  findRemoteProjectByName: (
    ...args: Parameters<ProjectStore['findRemoteProjectByName']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['findRemoteProjectByName']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.findRemoteProjectByName(...args)),
  pushToRemoteProject: (
    ...args: Parameters<ProjectStore['pushToRemoteProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['pushToRemoteProject']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.pushToRemoteProject(...args)),
  pullFromRemoteProject: (
    ...args: Parameters<ProjectStore['pullFromRemoteProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['pullFromRemoteProject']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.pullFromRemoteProject(...args)),
  getRemoteBranchInfo: (
    ...args: Parameters<ProjectStore['getRemoteBranchInfo']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getRemoteBranchInfo']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getRemoteBranchInfo(...args)),
  getProjectCommitHistory: (
    ...args: Parameters<ProjectStore['getProjectCommitHistory']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getProjectCommitHistory']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getProjectCommitHistory(...args)),
  getChangedDocumentsAtChange: (
    ...args: Parameters<ProjectStore['getChangedDocumentsAtChange']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getChangedDocumentsAtChange']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getChangedDocumentsAtChange(...args)),
  createDocument: (...args: Parameters<ProjectStore['createDocument']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['createDocument']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.createDocument(...args)),
  createDirectory: (...args: Parameters<ProjectStore['createDirectory']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['createDirectory']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.createDirectory(...args)),
  deleteDirectory: (...args: Parameters<ProjectStore['deleteDirectory']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['deleteDirectory']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.deleteDirectory(...args)),
  findDocumentById: (...args: Parameters<ProjectStore['findDocumentById']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['findDocumentById']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.findDocumentById(...args)),
  getDocumentLastChangeId: (
    ...args: Parameters<ProjectStore['getDocumentLastChangeId']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getDocumentLastChangeId']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getDocumentLastChangeId(...args)),
  updateRichTextDocumentContent: (
    ...args: Parameters<ProjectStore['updateRichTextDocumentContent']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<ProjectStore['updateRichTextDocumentContent']>
        >
      >,
      RepositoryError
    )(window.projectStoreAPI.updateRichTextDocumentContent(...args)),
  deleteDocument: (...args: Parameters<ProjectStore['deleteDocument']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['deleteDocument']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.deleteDocument(...args)),
  getDocumentHistory: (
    ...args: Parameters<ProjectStore['getDocumentHistory']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getDocumentHistory']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getDocumentHistory(...args)),
  getDocumentAtChange: (
    ...args: Parameters<ProjectStore['getDocumentAtChange']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
        [VersionedProjectDeletedDocumentErrorTag]: DeletedDocumentError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['getDocumentAtChange']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.getDocumentAtChange(...args)),
  isContentSameAtChanges: (
    ...args: Parameters<ProjectStore['isContentSameAtChanges']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['isContentSameAtChanges']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.isContentSameAtChanges(...args)),
  discardUncommittedChanges: (
    ...args: Parameters<ProjectStore['discardUncommittedChanges']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['discardUncommittedChanges']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.discardUncommittedChanges(...args)),
  resolveContentConflict: (
    ...args: Parameters<ProjectStore['resolveContentConflict']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<ProjectStore['resolveContentConflict']>>
      >,
      RepositoryError
    )(window.projectStoreAPI.resolveContentConflict(...args)),
});
