import {
  effectifyIPCPromise,
  type ErrorRegistry,
} from '../../../../../../../modules/infrastructure/cross-platform/electron-ipc-effect';
import {
  MergeConflictError,
  MigrationError,
} from '../../../../../../../modules/infrastructure/version-control';
import { type EffectErrorType } from '../../../../../../../utils/effect';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import { MultiDocumentProjectStore } from '../../../../ports/multi-document-project';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (): MultiDocumentProjectStore => ({
  createProject: (
    ...args: Parameters<MultiDocumentProjectStore['createProject']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
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
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
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
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
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
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
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
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
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
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
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
        ValidationError,
        RepositoryError,
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
        ValidationError,
        RepositoryError,
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
        ValidationError,
        RepositoryError,
        NotFoundError,
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
        ValidationError,
        RepositoryError,
        NotFoundError,
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
        ValidationError,
        RepositoryError,
        NotFoundError,
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
        ValidationError,
        RepositoryError,
        NotFoundError,
        MergeConflictError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<MultiDocumentProjectStore['mergeAndDeleteBranch']>
        >
      >,
      RepositoryError
    )(window.multiDocumentProjectStoreAPI.mergeAndDeleteBranch(...args)),
});
