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
import { SingleDocumentProjectStore } from '../../../../ports/single-document-project';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (projId: string): SingleDocumentProjectStore => ({
  supportsBranching: true,
  createSingleDocumentProject: (
    ...args: Parameters<
      SingleDocumentProjectStore['createSingleDocumentProject']
    >
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
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
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
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
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
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
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMigrationErrorTag]: MigrationError,
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
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
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
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
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
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
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
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
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
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
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
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
        [VersionControlMergeConflictErrorTag]: MergeConflictError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['mergeAndDeleteBranch']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.mergeAndDeleteBranch(...args)),
  getMergeConflictInfo: (
    ...args: Parameters<SingleDocumentProjectStore['getMergeConflictInfo']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['getMergeConflictInfo']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.getMergeConflictInfo(...args)),
  abortMerge: (...args: Parameters<SingleDocumentProjectStore['abortMerge']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<SingleDocumentProjectStore['abortMerge']>>
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.abortMerge(...args)),
  setAuthorInfo: (
    ...args: Parameters<SingleDocumentProjectStore['setAuthorInfo']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<SingleDocumentProjectStore['setAuthorInfo']>>
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.setAuthorInfo(...args)),
  addRemoteProject: (
    ...args: Parameters<SingleDocumentProjectStore['addRemoteProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectValidationErrorTag]: ValidationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['addRemoteProject']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.addRemoteProject(...args)),
  listRemoteProjects: (
    ...args: Parameters<SingleDocumentProjectStore['listRemoteProjects']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectValidationErrorTag]: ValidationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['listRemoteProjects']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.listRemoteProjects(...args)),
  findRemoteProjectByName: (
    ...args: Parameters<SingleDocumentProjectStore['findRemoteProjectByName']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['findRemoteProjectByName']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.findRemoteProjectByName(...args)),
  pushToRemoteProject: (
    ...args: Parameters<SingleDocumentProjectStore['pushToRemoteProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectValidationErrorTag]: ValidationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['pushToRemoteProject']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.pushToRemoteProject(...args)),
  pullFromRemoteProject: (
    ...args: Parameters<SingleDocumentProjectStore['pullFromRemoteProject']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectValidationErrorTag]: ValidationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['pullFromRemoteProject']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.pullFromRemoteProject(...args)),
  getRemoteBranchInfo: (
    ...args: Parameters<SingleDocumentProjectStore['getRemoteBranchInfo']>
  ) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
        [VersionedProjectValidationErrorTag]: ValidationError,
        [VersionedProjectNotFoundErrorTag]: NotFoundError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<SingleDocumentProjectStore['getRemoteBranchInfo']>
        >
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.getRemoteBranchInfo(...args)),
  disconnect: (...args: Parameters<SingleDocumentProjectStore['disconnect']>) =>
    effectifyIPCPromise(
      {
        [VersionedProjectRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<SingleDocumentProjectStore['disconnect']>>
      >,
      RepositoryError
    )(window.singleDocumentProjectStoreAPI.disconnect(...args, projId)),
});
