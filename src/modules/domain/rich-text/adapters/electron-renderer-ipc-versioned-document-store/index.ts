import {
  effectifyIPCPromise,
  type ErrorRegistry,
} from '../../../../../modules/infrastructure/cross-platform/electron-ipc-effect';
import { MigrationError } from '../../../../../modules/infrastructure/version-control';
import { type EffectErrorType } from '../../../../../utils/effect';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import { type VersionedDocumentStore } from '../../ports';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (projId?: string): VersionedDocumentStore => ({
  projectId: projId ?? null,
  setProjectId: (...args: Parameters<VersionedDocumentStore['setProjectId']>) =>
    effectifyIPCPromise(
      {} as ErrorRegistry<
        EffectErrorType<ReturnType<VersionedDocumentStore['setProjectId']>>
      >
    )(window.versionedDocumentStoreAPI.setProjectId(...args)),
  createDocument: (
    ...args: Parameters<VersionedDocumentStore['createDocument']>
  ) =>
    effectifyIPCPromise(
      { ValidationError, RepositoryError } as ErrorRegistry<
        EffectErrorType<ReturnType<VersionedDocumentStore['createDocument']>>
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.createDocument(...args)),
  findDocumentById: (
    ...args: Parameters<VersionedDocumentStore['findDocumentById']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<VersionedDocumentStore['findDocumentById']>>
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.findDocumentById(...args)),
  getDocumentLastChangeId: (
    ...args: Parameters<VersionedDocumentStore['getDocumentLastChangeId']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<VersionedDocumentStore['getDocumentLastChangeId']>
        >
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.getDocumentLastChangeId(...args)),
  updateRichTextDocumentContent: (
    ...args: Parameters<VersionedDocumentStore['updateRichTextDocumentContent']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<VersionedDocumentStore['updateRichTextDocumentContent']>
        >
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.updateRichTextDocumentContent(...args)),
  deleteDocument: (
    ...args: Parameters<VersionedDocumentStore['deleteDocument']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<VersionedDocumentStore['deleteDocument']>>
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.deleteDocument(...args)),
  commitChanges: (
    ...args: Parameters<VersionedDocumentStore['commitChanges']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<VersionedDocumentStore['commitChanges']>>
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.commitChanges(...args)),
  getDocumentHistory: (
    ...args: Parameters<VersionedDocumentStore['getDocumentHistory']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<VersionedDocumentStore['getDocumentHistory']>
        >
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.getDocumentHistory(...args)),
  getDocumentAtChange: (
    ...args: Parameters<VersionedDocumentStore['getDocumentAtChange']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<VersionedDocumentStore['getDocumentAtChange']>
        >
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.getDocumentAtChange(...args)),
  isContentSameAtChanges: (
    ...args: Parameters<VersionedDocumentStore['isContentSameAtChanges']>
  ) =>
    effectifyIPCPromise(
      {
        ValidationError,
        RepositoryError,
        NotFoundError,
        MigrationError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<VersionedDocumentStore['isContentSameAtChanges']>
        >
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.isContentSameAtChanges(...args)),
  disconnect: (...args: Parameters<VersionedDocumentStore['disconnect']>) =>
    effectifyIPCPromise(
      {
        RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<VersionedDocumentStore['disconnect']>>
      >,
      RepositoryError
    )(window.versionedDocumentStoreAPI.disconnect(...args)),
});
