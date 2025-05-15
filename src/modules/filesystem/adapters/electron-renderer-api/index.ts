import { Filesystem } from '../../ports/filesystem';

// This adapter just calls the relevant exposed functions from the preload script
// to send the messages to the main Electron process which will do the heavy lifting.
export const createAdapter = (): Filesystem => ({
  openDirectory: window.filesystemAPI.openDirectory,
  getDirectory: window.filesystemAPI.getDirectory,
  listDirectoryFiles: window.filesystemAPI.listDirectoryFiles,
  requestPermissionForDirectory:
    window.filesystemAPI.requestPermissionForDirectory,
  assertWritePermissionForDirectory:
    window.filesystemAPI.assertWritePermissionForDirectory,
  createNewFile: window.filesystemAPI.createNewFile,
  writeFile: window.filesystemAPI.writeFile,
  readFile: window.filesystemAPI.readFile,
});
