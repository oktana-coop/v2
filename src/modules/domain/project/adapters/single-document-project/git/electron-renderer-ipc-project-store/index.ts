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
import { SingleDocumentProjectStore } from '../../../../ports/single-document-project';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (projId: string): SingleDocumentProjectStore => ({
  createSingleDocumentProject: (
    ...args: Parameters<
      SingleDocumentProjectStore['createSingleDocumentProject']
    >
  ) =>
    effectifyIPCPromise(
      {
        RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['createSingleDocumentProject']>
        >
      >,
      RepositoryError
    )(
      window.singleDocumentProjectStoreAPI.createSingleDocumentProject(
        ...args,
        projId
      )
    ),
  findDocumentInProject: (
    ...args: Parameters<SingleDocumentProjectStore['findDocumentInProject']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['findDocumentInProject']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.findDocumentInProject(...args)),
  findProjectById: (
    ...args: Parameters<SingleDocumentProjectStore['findProjectById']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['findProjectById']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.findProjectById(...args)),
  getProjectName: (
    ...args: Parameters<SingleDocumentProjectStore['getProjectName']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['getProjectName']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.getProjectName(...args)),
  createAndSwitchToBranch: (
    ...args: Parameters<SingleDocumentProjectStore['createAndSwitchToBranch']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['createAndSwitchToBranch']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.createAndSwitchToBranch(...args)),
  switchToBranch: (
    ...args: Parameters<SingleDocumentProjectStore['switchToBranch']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['switchToBranch']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.switchToBranch(...args)),
  getCurrentBranch: (
    ...args: Parameters<SingleDocumentProjectStore['getCurrentBranch']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['getCurrentBranch']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.getCurrentBranch(...args)),
  listBranches: (
    ...args: Parameters<SingleDocumentProjectStore['listBranches']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<SingleDocumentProjectStore['listBranches']>>
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.listBranches(...args)),
  deleteBranch: (
    ...args: Parameters<SingleDocumentProjectStore['deleteBranch']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<SingleDocumentProjectStore['deleteBranch']>>
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.deleteBranch(...args)),
  mergeAndDeleteBranch: (
    ...args: Parameters<SingleDocumentProjectStore['mergeAndDeleteBranch']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MergeConflictError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['mergeAndDeleteBranch']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.mergeAndDeleteBranch(...args)),
  disconnect: (...args: Parameters<SingleDocumentProjectStore['disconnect']>) =>
    effectifyIPCPromise(
      {
        RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<SingleDocumentProjectStore['disconnect']>>
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.disconnect(...args, projId)),
});
