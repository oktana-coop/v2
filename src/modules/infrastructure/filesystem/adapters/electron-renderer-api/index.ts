import {
  effectifyIPCPromise,
  type ErrorRegistry,
} from '../../../../../modules/infrastructure/cross-platform/electron-ipc-effect';
import {
  AbortError as FilesystemAbortError,
  AccessControlError as FilesystemAccessControlError,
  DataIntegrityError as FilesystemDataIntegrityError,
  type Filesystem,
  NotFoundError as FilesystemNotFoundError,
  RepositoryError as FilesystemRepositoryError,
} from '../../../../../modules/infrastructure/filesystem';
import { type EffectErrorType } from '../../../../../utils/effect';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (): Filesystem => ({
  openDirectory: (...args: Parameters<Filesystem['openDirectory']>) =>
    effectifyIPCPromise(
      {
        FilesystemAbortError,
        FilesystemRepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['openDirectory']>>
      >,
      FilesystemRepositoryError
    )(window.filesystemAPI.openDirectory(...args)),
  getDirectory: (...args: Parameters<Filesystem['getDirectory']>) =>
    effectifyIPCPromise(
      {
        FilesystemNotFoundError,
        FilesystemRepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['getDirectory']>>
      >,
      FilesystemRepositoryError
    )(window.filesystemAPI.getDirectory(...args)),
  listDirectoryFiles: (...args: Parameters<Filesystem['listDirectoryFiles']>) =>
    effectifyIPCPromise(
      {
        FilesystemDataIntegrityError,
        FilesystemNotFoundError,
        FilesystemRepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['listDirectoryFiles']>>
      >,
      FilesystemRepositoryError
    )(window.filesystemAPI.listDirectoryFiles(...args)),
  requestPermissionForDirectory: (
    ...args: Parameters<Filesystem['requestPermissionForDirectory']>
  ) =>
    effectifyIPCPromise(
      {
        FilesystemAccessControlError,
        FilesystemNotFoundError,
        FilesystemRepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['requestPermissionForDirectory']>>
      >,
      FilesystemRepositoryError
    )(window.filesystemAPI.requestPermissionForDirectory(...args)),
  assertWritePermissionForDirectory: (
    ...args: Parameters<Filesystem['assertWritePermissionForDirectory']>
  ) =>
    effectifyIPCPromise(
      {
        FilesystemAccessControlError,
        FilesystemNotFoundError,
        FilesystemRepositoryError,
      } as ErrorRegistry<
        EffectErrorType<
          ReturnType<Filesystem['assertWritePermissionForDirectory']>
        >
      >,
      FilesystemRepositoryError
    )(window.filesystemAPI.assertWritePermissionForDirectory(...args)),
  createNewFile: (...args: Parameters<Filesystem['createNewFile']>) =>
    effectifyIPCPromise(
      {
        FilesystemAbortError,
        FilesystemNotFoundError,
        FilesystemRepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['createNewFile']>>
      >,
      FilesystemRepositoryError
    )(window.filesystemAPI.createNewFile(...args)),
  openFile: (...args: Parameters<Filesystem['openFile']>) =>
    effectifyIPCPromise(
      {
        FilesystemAbortError,
        FilesystemRepositoryError,
      } as ErrorRegistry<EffectErrorType<ReturnType<Filesystem['openFile']>>>,
      FilesystemRepositoryError
    )(window.filesystemAPI.openFile(...args)),
  writeFile: (...args: Parameters<Filesystem['writeFile']>) =>
    effectifyIPCPromise(
      {
        FilesystemAccessControlError,
        FilesystemNotFoundError,
        FilesystemRepositoryError,
      } as ErrorRegistry<EffectErrorType<ReturnType<Filesystem['writeFile']>>>,
      FilesystemRepositoryError
    )(window.filesystemAPI.writeFile(...args)),
  readFile: (...args: Parameters<Filesystem['readFile']>) =>
    effectifyIPCPromise(
      {
        FilesystemAccessControlError,
        FilesystemNotFoundError,
        FilesystemRepositoryError,
      } as ErrorRegistry<EffectErrorType<ReturnType<Filesystem['readFile']>>>,
      FilesystemRepositoryError
    )(window.filesystemAPI.readFile(...args)),
  getRelativePath: (...args: Parameters<Filesystem['getRelativePath']>) =>
    effectifyIPCPromise(
      {
        FilesystemRepositoryError,
      } as ErrorRegistry<
        EffectErrorType<ReturnType<Filesystem['getRelativePath']>>
      >,
      FilesystemRepositoryError
    )(window.filesystemAPI.getRelativePath(...args)),
});
