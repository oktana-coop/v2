import * as Effect from 'effect/Effect';

import {
  effectifyIPCPromise,
  type ErrorRegistry,
} from '../../../../../../../modules/infrastructure/cross-platform';
import {
  MigrationError,
  VersionControlMigrationErrorTag,
} from '../../../../../../../modules/infrastructure/version-control';
import { type EffectErrorType } from '../../../../../../../utils/effect';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
  VersionedDocumentNotFoundErrorTag,
  VersionedDocumentRepositoryErrorTag,
  VersionedDocumentValidationErrorTag,
} from '../../../../errors';
import { type VersionedDocumentStore } from '../../../../ports';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = ({
  projectId: projId,
  managesFilesystemWorkdir,
}: {
  projectId: string;
  managesFilesystemWorkdir: boolean;
}): VersionedDocumentStore => {
  let projectId: string = projId;
  const setProjId: VersionedDocumentStore['setProjectId'] = (id) =>
    Effect.sync(() => {
      projectId = id;
    });

  return {
    projectId,
    setProjectId: (
      ...args: Parameters<VersionedDocumentStore['setProjectId']>
    ) => {
      setProjId(...args);

      return effectifyIPCPromise(
        {} as ErrorRegistry<
          EffectErrorType<ReturnType<VersionedDocumentStore['setProjectId']>>
        >
      )(window.versionedDocumentStoreAPI.setProjectId(...args));
    },
    managesFilesystemWorkdir,
    createDocument: (
      ...args: Parameters<VersionedDocumentStore['createDocument']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
        } as ErrorRegistry<
          EffectErrorType<ReturnType<VersionedDocumentStore['createDocument']>>
        >,
        RepositoryError
      )(window.versionedDocumentStoreAPI.createDocument(...args, projectId)),
    findDocumentById: (
      ...args: Parameters<VersionedDocumentStore['findDocumentById']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          [VersionControlMigrationErrorTag]: MigrationError,
        } as ErrorRegistry<
          EffectErrorType<
            ReturnType<VersionedDocumentStore['findDocumentById']>
          >
        >,
        RepositoryError
      )(window.versionedDocumentStoreAPI.findDocumentById(...args, projectId)),
    getDocumentLastChangeId: (
      ...args: Parameters<VersionedDocumentStore['getDocumentLastChangeId']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          [VersionControlMigrationErrorTag]: MigrationError,
        } as ErrorRegistry<
          EffectErrorType<
            ReturnType<VersionedDocumentStore['getDocumentLastChangeId']>
          >
        >,
        RepositoryError
      )(
        window.versionedDocumentStoreAPI.getDocumentLastChangeId(
          ...args,
          projectId
        )
      ),
    updateRichTextDocumentContent: (
      ...args: Parameters<
        VersionedDocumentStore['updateRichTextDocumentContent']
      >
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          [VersionControlMigrationErrorTag]: MigrationError,
        } as ErrorRegistry<
          EffectErrorType<
            ReturnType<VersionedDocumentStore['updateRichTextDocumentContent']>
          >
        >,
        RepositoryError
      )(
        window.versionedDocumentStoreAPI.updateRichTextDocumentContent(
          ...args,
          projectId
        )
      ),
    deleteDocument: (
      ...args: Parameters<VersionedDocumentStore['deleteDocument']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          [VersionControlMigrationErrorTag]: MigrationError,
        } as ErrorRegistry<
          EffectErrorType<ReturnType<VersionedDocumentStore['deleteDocument']>>
        >,
        RepositoryError
      )(window.versionedDocumentStoreAPI.deleteDocument(...args, projectId)),
    commitChanges: (
      ...args: Parameters<VersionedDocumentStore['commitChanges']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          [VersionControlMigrationErrorTag]: MigrationError,
        } as ErrorRegistry<
          EffectErrorType<ReturnType<VersionedDocumentStore['commitChanges']>>
        >,
        RepositoryError
      )(window.versionedDocumentStoreAPI.commitChanges(...args, projectId)),
    getDocumentHistory: (
      ...args: Parameters<VersionedDocumentStore['getDocumentHistory']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          MigrationError,
        } as ErrorRegistry<
          EffectErrorType<
            ReturnType<VersionedDocumentStore['getDocumentHistory']>
          >
        >,
        RepositoryError
      )(
        window.versionedDocumentStoreAPI.getDocumentHistory(...args, projectId)
      ),
    getDocumentAtChange: (
      ...args: Parameters<VersionedDocumentStore['getDocumentAtChange']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          [VersionControlMigrationErrorTag]: MigrationError,
        } as ErrorRegistry<
          EffectErrorType<
            ReturnType<VersionedDocumentStore['getDocumentAtChange']>
          >
        >,
        RepositoryError
      )(
        window.versionedDocumentStoreAPI.getDocumentAtChange(...args, projectId)
      ),
    restoreCommit: (
      ...args: Parameters<VersionedDocumentStore['restoreCommit']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          [VersionControlMigrationErrorTag]: MigrationError,
        } as ErrorRegistry<
          EffectErrorType<ReturnType<VersionedDocumentStore['restoreCommit']>>
        >,
        RepositoryError
      )(window.versionedDocumentStoreAPI.restoreCommit(...args, projectId)),
    discardUncommittedChanges: (
      ...args: Parameters<VersionedDocumentStore['discardUncommittedChanges']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          [VersionControlMigrationErrorTag]: MigrationError,
        } as ErrorRegistry<
          EffectErrorType<
            ReturnType<VersionedDocumentStore['discardUncommittedChanges']>
          >
        >,
        RepositoryError
      )(
        window.versionedDocumentStoreAPI.discardUncommittedChanges(
          ...args,
          projectId
        )
      ),
    isContentSameAtChanges: (
      ...args: Parameters<VersionedDocumentStore['isContentSameAtChanges']>
    ) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentValidationErrorTag]: ValidationError,
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
          [VersionedDocumentNotFoundErrorTag]: NotFoundError,
          [VersionControlMigrationErrorTag]: MigrationError,
        } as ErrorRegistry<
          EffectErrorType<
            ReturnType<VersionedDocumentStore['isContentSameAtChanges']>
          >
        >,
        RepositoryError
      )(
        window.versionedDocumentStoreAPI.isContentSameAtChanges(
          ...args,
          projectId
        )
      ),
    disconnect: (...args: Parameters<VersionedDocumentStore['disconnect']>) =>
      effectifyIPCPromise(
        {
          [VersionedDocumentRepositoryErrorTag]: RepositoryError,
        } as ErrorRegistry<
          EffectErrorType<ReturnType<VersionedDocumentStore['disconnect']>>
        >,
        RepositoryError
      )(window.versionedDocumentStoreAPI.disconnect(...args, projectId)),
  };
};
