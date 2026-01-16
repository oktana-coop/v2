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
});
