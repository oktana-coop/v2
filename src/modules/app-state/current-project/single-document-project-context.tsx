import * as Effect from 'effect/Effect';
import { createContext, useContext, useEffect, useState } from 'react';

import { createDocumentAndProject } from '../../domain/project';
import { VersionedDocumentHandle } from '../../domain/rich-text';
import { ElectronContext } from '../../infrastructure/cross-platform/electron-context';
import { type Directory, type File } from '../../infrastructure/filesystem';
import { VersionControlId } from '../../infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';

type BrowserStorageProjectData = {
  directoryName: Directory['name'];
  directoryPath: Directory['path'];
  versionControlId: VersionControlId;
};

const BROWSER_STORAGE_PROJECT_DATA_KEY = 'project';

export type SingleDocumentProjectContextType = {
  projectId: VersionControlId | null;
  directory: Directory | null;
  directoryFiles: Array<File>;
  openDirectory: () => Promise<Directory | null>;
  requestPermissionForSelectedDirectory: () => Promise<void>;
  createNewDocument: (
    suggestedName: string
  ) => Promise<{ documentId: VersionControlId; path: string }>;
  findDocumentInProject: (args: {
    projectId: VersionControlId;
    documentPath: string;
  }) => Promise<VersionedDocumentHandle>;
};

export const SingleDocumentProjectContext =
  createContext<SingleDocumentProjectContextType>({
    projectId: null,
    directory: null,
    directoryFiles: [],
    openDirectory: async () => null,
    // @ts-expect-error will get overriden below
    requestPermissionForSelectedDirectory: async () => null,
    // @ts-expect-error will get overriden below
    createNewDocument: () => null,
    // @ts-expect-error will get overriden below
    findDocumentInProject: async () => null,
  });

export const SingleDocumentProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isElectron } = useContext(ElectronContext);
  const { filesystem, versionedDocumentStore, versionedProjectStore } =
    useContext(InfrastructureAdaptersContext);
  const [projectId, setProjectId] = useState<VersionControlId | null>(null);

  const handleCreateNewDocument = async (suggestedName: string) => {
    const newFile = await Effect.runPromise(
      directory
        ? filesystem.createNewFile(suggestedName, directory)
        : filesystem.createNewFile(suggestedName)
    );

    // Refresh directory files if a directory is selected
    if (
      directory &&
      directory.permissionState === 'granted' &&
      directory.path
    ) {
      const files = await Effect.runPromise(
        filesystem.listDirectoryFiles(directory.path)
      );
      setDirectoryFiles(files);
    }

    const newDocumentId = await Effect.runPromise(
      createVersionedDocument({
        createDocument: versionedDocumentStore.createDocument,
        addDocumentToProject: versionedProjectStore.addDocumentToProject,
      })({
        name: newFile.name,
        title: suggestedName,
        path: newFile.path!,
        projectId,
        content: null,
      })
    );

    return { documentId: newDocumentId, path: newFile.path! };
  };

  return (
    <SingleDocumentProjectContext.Provider
      value={{
        projectId,
        directory,
        directoryFiles,
        openDirectory,
        requestPermissionForSelectedDirectory,
        createNewDocument: handleCreateNewDocument,
        findDocumentInProject: handleFindDocumentInProject,
      }}
    >
      {children}
    </SingleDocumentProjectContext.Provider>
  );
};
