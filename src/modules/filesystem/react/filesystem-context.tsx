import * as Effect from 'effect/Effect';
import { createContext, useContext } from 'react';

import { ElectronContext } from '../../electron/context';
import { createAdapter as createBrowserFilesystemAPIAdapter } from '../adapters/browser-api/browser-filesystem-api/adapter';
import { createAdapter as createElectronRendererFilesystemAPIAdapter } from '../adapters/electron-renderer-api';
import { Filesystem } from '../ports/filesystem';
import type { Directory, File } from '../types';

export type FilesystemContextType = {
  filesystem: Filesystem;
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<File>;
  listDirectoryFiles: (path: string) => Promise<Array<File>>;
  requestPermissionForDirectory: (dir: Directory) => Promise<PermissionState>;
};

export const FilesystemContext = createContext<FilesystemContextType>({
  // @ts-expect-error will get overriden below
  writeFile: () => {},
  // @ts-expect-error will get overriden below
  readFile: () => {},
  // @ts-expect-error will get overriden below
  listDirectoryFiles: () => {},
  // @ts-expect-error will get overriden below
  requestPermissionForDirectory: () => null,
});

export const FilesystemProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isElectron } = useContext(ElectronContext);

  const filesystem = isElectron
    ? createElectronRendererFilesystemAPIAdapter()
    : createBrowserFilesystemAPIAdapter();

  const requestPermissionForDirectory = async (dir: Directory) => {
    if (!dir.path) {
      throw new Error('The directory does not have a path');
    }

    return Effect.runPromise(
      filesystem.requestPermissionForDirectory(dir.path)
    );
  };

  const writeFile = (path: string, content: string) =>
    Effect.runPromise(filesystem.writeFile(path, content));
  const readFile = (path: string) =>
    Effect.runPromise(filesystem.readFile(path));
  const listDirectoryFiles = (path: string) =>
    Effect.runPromise(filesystem.listDirectoryFiles(path));

  return (
    <FilesystemContext.Provider
      value={{
        filesystem,
        readFile,
        writeFile,
        listDirectoryFiles,
        requestPermissionForDirectory,
      }}
    >
      {children}
    </FilesystemContext.Provider>
  );
};
