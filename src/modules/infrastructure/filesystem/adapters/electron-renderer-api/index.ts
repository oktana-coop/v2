import {
  effectifyIPCPromise,
  type ErrorRegistry,
} from '../../../../../modules/infrastructure/cross-platform';
import {
  AbortError,
  AccessControlError,
  DataIntegrityError,
  type Filesystem,
  FilesystemAbortErrorTag,
  FilesystemAccessControlErrorTag,
  FilesystemNotFoundErrorTag,
  FilesystemRepositoryErrorTag,
  FileystemDataIntegrityErrorTag,
  NotFoundError,
  RepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { type EffectErrorType } from '../../../../../utils/effect';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (): Filesystem => ({
  openDirectory: (...args: Parameters<Filesystem['openDirectory']>) =>
    effectifyIPCPromise(
      {
        [FilesystemAbortErrorTag]: AbortError,
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['openDirectory']>>
      >,
      RepositoryError
    )(window.filesystemAPI.openDirectory(...args)),
  getDirectory: (...args: Parameters<Filesystem['getDirectory']>) =>
    effectifyIPCPromise(
      {
        [FilesystemNotFoundErrorTag]: NotFoundError,
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['getDirectory']>>
      >,
      RepositoryError
    )(window.filesystemAPI.getDirectory(...args)),
  listDirectoryFiles: (...args: Parameters<Filesystem['listDirectoryFiles']>) =>
    effectifyIPCPromise(
      {
        [FileystemDataIntegrityErrorTag]: DataIntegrityError,
        [FilesystemNotFoundErrorTag]: NotFoundError,
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['listDirectoryFiles']>>
      >,
      RepositoryError
    )(window.filesystemAPI.listDirectoryFiles(...args)),
  requestPermissionForDirectory: (
    ...args: Parameters<Filesystem['requestPermissionForDirectory']>
  ) =>
    effectifyIPCPromise(
      {
        [FilesystemAccessControlErrorTag]: AccessControlError,
        [FilesystemNotFoundErrorTag]: NotFoundError,
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['requestPermissionForDirectory']>>
      >,
      RepositoryError
    )(window.filesystemAPI.requestPermissionForDirectory(...args)),
  assertWritePermissionForDirectory: (
    ...args: Parameters<Filesystem['assertWritePermissionForDirectory']>
  ) =>
    effectifyIPCPromise(
      {
        [FilesystemAccessControlErrorTag]: AccessControlError,
        [FilesystemNotFoundErrorTag]: NotFoundError,
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<Filesystem['assertWritePermissionForDirectory']>
        >
      >,
      RepositoryError
    )(window.filesystemAPI.assertWritePermissionForDirectory(...args)),
  createNewFile: (...args: Parameters<Filesystem['createNewFile']>) =>
    effectifyIPCPromise(
      {
        [FilesystemAbortErrorTag]: AbortError,
        [FilesystemNotFoundErrorTag]: NotFoundError,
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['createNewFile']>>
      >,
      RepositoryError
    )(window.filesystemAPI.createNewFile(...args)),
  openFile: (...args: Parameters<Filesystem['openFile']>) =>
    effectifyIPCPromise(
      {
        [FilesystemAbortErrorTag]: AbortError,
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<EffectErrorType<ReturnType<Filesystem['openFile']>>>,
      RepositoryError
    )(window.filesystemAPI.openFile(...args)),
  writeFile: (...args: Parameters<Filesystem['writeFile']>) =>
    effectifyIPCPromise(
      {
        [FilesystemAccessControlErrorTag]: AccessControlError,
        [FilesystemNotFoundErrorTag]: NotFoundError,
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<EffectErrorType<ReturnType<Filesystem['writeFile']>>>,
      RepositoryError
    )(window.filesystemAPI.writeFile(...args)),
  readFile: (...args: Parameters<Filesystem['readFile']>) =>
    effectifyIPCPromise(
      {
        [FilesystemAccessControlErrorTag]: AccessControlError,
        [FilesystemNotFoundErrorTag]: NotFoundError,
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<EffectErrorType<ReturnType<Filesystem['readFile']>>>,
      RepositoryError
    )(window.filesystemAPI.readFile(...args)),
  getRelativePath: (...args: Parameters<Filesystem['getRelativePath']>) =>
    effectifyIPCPromise(
      {
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['getRelativePath']>>
      >,
      RepositoryError
    )(window.filesystemAPI.getRelativePath(...args)),
  getAbsolutePath: (...args: Parameters<Filesystem['getAbsolutePath']>) =>
    effectifyIPCPromise(
      {
        [FilesystemRepositoryErrorTag]: RepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['getAbsolutePath']>>
      >,
      RepositoryError
    )(window.filesystemAPI.getAbsolutePath(...args)),
});
