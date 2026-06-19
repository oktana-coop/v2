import {
  effectifyIPCPromise,
  type ErrorRegistry,
} from '../../../../../../../modules/infrastructure/cross-platform';
import {
  MergeConflictError,
  MigrationError,
  VersionControlMergeConflictErrorTag,
  VersionControlMigrationErrorTag,
} from '../../../../../../../modules/infrastructure/version-control';
import { type EffectErrorType } from '../../../../../../../utils/effect';
import { DEFAULT_ASSETS_DIR_NAME } from '../../../../constants';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
  VersionedProjectNotFoundErrorTag,
  VersionedProjectRepositoryErrorTag,
  VersionedProjectValidationErrorTag,
} from '../../../../errors';
import { MultiDocumentProjectStore } from '../../../../ports/multi-document-project';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (): MultiDocumentProjectStore => ({
  supportsBranching: true,
  assetsDirName: DEFAULT_ASSETS_DIR_NAME,
  createProject: (
    ...args: Parameters<MultiDocumentProjectStore['createProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<MultiDocumentProjectStore['createProject']>>
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.createProject(...args)),
  findProjectById: (
    ...args: Parameters<MultiDocumentProjectStore['findProjectById']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['findProjectById']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.findProjectById(...args)),
  listProjectDocuments: (
    ...args: Parameters<MultiDocumentProjectStore['listProjectDocuments']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['listProjectDocuments']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.listProjectDocuments(...args)),
  addDocumentToProject: (
    ...args: Parameters<MultiDocumentProjectStore['addDocumentToProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['addDocumentToProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.addDocumentToProject(...args)),
  deleteDocumentFromProject: (
    ...args: Parameters<MultiDocumentProjectStore['deleteDocumentFromProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['deleteDocumentFromProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.deleteDocumentFromProject(...args)),
  deleteDocumentsFromProject: (
    ...args: Parameters<MultiDocumentProjectStore['deleteDocumentsFromProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['deleteDocumentsFromProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.deleteDocumentsFromProject(...args)),
  renameDocumentInProject: (
    ...args: Parameters<MultiDocumentProjectStore['renameDocumentInProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['renameDocumentInProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.renameDocumentInProject(...args)),
  renameDocumentsInProject: (
    ...args: Parameters<MultiDocumentProjectStore['renameDocumentsInProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['renameDocumentsInProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.renameDocumentsInProject(...args)),
  findDocumentInProject: (
    ...args: Parameters<MultiDocumentProjectStore['findDocumentInProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['findDocumentInProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.findDocumentInProject(...args)),
  addAssetToProject: (
    ...args: Parameters<MultiDocumentProjectStore['addAssetToProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['addAssetToProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.addAssetToProject(...args)),
  deleteAssetFromProject: (
    ...args: Parameters<MultiDocumentProjectStore['deleteAssetFromProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['deleteAssetFromProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.deleteAssetFromProject(...args)),
  lookupAssetByName: (
    ...args: Parameters<MultiDocumentProjectStore['lookupAssetByName']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['lookupAssetByName']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.lookupAssetByName(...args)),
  listProjectAssets: (
    ...args: Parameters<MultiDocumentProjectStore['listProjectAssets']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['listProjectAssets']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.listProjectAssets(...args)),
  readAssetBytes: (
    ...args: Parameters<MultiDocumentProjectStore['readAssetBytes']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<MultiDocumentProjectStore['readAssetBytes']>>
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.readAssetBytes(...args)),
  readDocumentReferencedAssets: (
    ...args: Parameters<
      MultiDocumentProjectStore['readDocumentReferencedAssets']
    >
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['readDocumentReferencedAssets']>
        >
      >,
      RepositoryError
    )(
      window.multiDocumentProjectStoreAPI.readDocumentReferencedAssets(...args)
    ),
  getProjectRelativePath: (
    ...args: Parameters<MultiDocumentProjectStore['getProjectRelativePath']>
  ) =>
    effectifyIPCPromise(
      {} as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['getProjectRelativePath']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.getProjectRelativePath(...args)),
  commitChanges: (
    ...args: Parameters<MultiDocumentProjectStore['commitChanges']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<MultiDocumentProjectStore['commitChanges']>>
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.commitChanges(...args)),
  commitDocumentChanges: (
    ...args: Parameters<MultiDocumentProjectStore['commitDocumentChanges']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['commitDocumentChanges']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.commitDocumentChanges(...args)),
  restoreDocumentChanges: (
    ...args: Parameters<MultiDocumentProjectStore['restoreDocumentChanges']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['restoreDocumentChanges']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.restoreDocumentChanges(...args)),
  createAndSwitchToBranch: (
    ...args: Parameters<MultiDocumentProjectStore['createAndSwitchToBranch']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['createAndSwitchToBranch']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.createAndSwitchToBranch(...args)),
  switchToBranch: (
    ...args: Parameters<MultiDocumentProjectStore['switchToBranch']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<MultiDocumentProjectStore['switchToBranch']>>
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.switchToBranch(...args)),
  getCurrentBranch: (
    ...args: Parameters<MultiDocumentProjectStore['getCurrentBranch']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['getCurrentBranch']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.getCurrentBranch(...args)),
  listBranches: (
    ...args: Parameters<MultiDocumentProjectStore['listBranches']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<MultiDocumentProjectStore['listBranches']>>
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.listBranches(...args)),
  deleteBranch: (
    ...args: Parameters<MultiDocumentProjectStore['deleteBranch']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<MultiDocumentProjectStore['deleteBranch']>>
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.deleteBranch(...args)),
  mergeAndDeleteBranch: (
    ...args: Parameters<MultiDocumentProjectStore['mergeAndDeleteBranch']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMergeConflictErrorTag]: MergeConflictError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['mergeAndDeleteBranch']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.mergeAndDeleteBranch(...args)),
  getMergeConflictInfo: (
    ...args: Parameters<MultiDocumentProjectStore['getMergeConflictInfo']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['getMergeConflictInfo']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.getMergeConflictInfo(...args)),
  abortMerge: (...args: Parameters<MultiDocumentProjectStore['abortMerge']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<MultiDocumentProjectStore['abortMerge']>>
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.abortMerge(...args)),
  resolveConflictByKeepingDocument: (
    ...args: Parameters<
      MultiDocumentProjectStore['resolveConflictByKeepingDocument']
    >
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<
            MultiDocumentProjectStore['resolveConflictByKeepingDocument']
          >
        >
      >,
      RepositoryError
    )(
      window.multiDocumentProjectStoreAPI.resolveConflictByKeepingDocument(
        ...args
      )
    ),
  resolveConflictByDeletingDocument: (
    ...args: Parameters<
      MultiDocumentProjectStore['resolveConflictByDeletingDocument']
    >
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<
            MultiDocumentProjectStore['resolveConflictByDeletingDocument']
          >
        >
      >,
      RepositoryError
    )(
      window.multiDocumentProjectStoreAPI.resolveConflictByDeletingDocument(
        ...args
      )
    ),
  commitMergeConflictsResolution: (
    ...args: Parameters<
      MultiDocumentProjectStore['commitMergeConflictsResolution']
    >
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<
            MultiDocumentProjectStore['commitMergeConflictsResolution']
          >
        >
      >,
      RepositoryError
    )(
      window.multiDocumentProjectStoreAPI.commitMergeConflictsResolution(
        ...args
      )
    ),
  setAuthorInfo: (
    ...args: Parameters<MultiDocumentProjectStore['setAuthorInfo']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<MultiDocumentProjectStore['setAuthorInfo']>>
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.setAuthorInfo(...args)),
  addRemoteProject: (
    ...args: Parameters<MultiDocumentProjectStore['addRemoteProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['addRemoteProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.addRemoteProject(...args)),
  listRemoteProjects: (
    ...args: Parameters<MultiDocumentProjectStore['listRemoteProjects']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['listRemoteProjects']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.listRemoteProjects(...args)),
  findRemoteProjectByName: (
    ...args: Parameters<MultiDocumentProjectStore['findRemoteProjectByName']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['findRemoteProjectByName']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.findRemoteProjectByName(...args)),
  pushToRemoteProject: (
    ...args: Parameters<MultiDocumentProjectStore['pushToRemoteProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['pushToRemoteProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.pushToRemoteProject(...args)),
  pullFromRemoteProject: (
    ...args: Parameters<MultiDocumentProjectStore['pullFromRemoteProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['pullFromRemoteProject']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.pullFromRemoteProject(...args)),
  getRemoteBranchInfo: (
    ...args: Parameters<MultiDocumentProjectStore['getRemoteBranchInfo']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['getRemoteBranchInfo']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.getRemoteBranchInfo(...args)),
  getProjectCommitHistory: (
    ...args: Parameters<MultiDocumentProjectStore['getProjectCommitHistory']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['getProjectCommitHistory']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.getProjectCommitHistory(...args)),
  getChangedDocumentsAtChange: (
    ...args: Parameters<
      MultiDocumentProjectStore['getChangedDocumentsAtChange']
    >
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['getChangedDocumentsAtChange']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.getChangedDocumentsAtChange(...args)),
});
