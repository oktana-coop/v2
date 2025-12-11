import {
  effectifyIPCPromise,
  type ErrorRegistry,
} from '../../../../../../../modules/infrastructure/cross-platform/electron-ipc-effect';
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
});
