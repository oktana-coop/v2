import * as Effect from 'effect/Effect';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  createProjectFromFilesystemContent,
  createVersionedDocument,
  findDocumentInProject,
  updateProjectFromFilesystemContent,
} from '../../domain/project';
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

export type MultiDocumentProjectContextType = {
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
  canCreateDocument: () => boolean;
  canShowFiles: () => boolean;
};

export const MultiDocumentProjectContext =
  createContext<MultiDocumentProjectContextType>({
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
    canCreateDocument: () => false,
    canShowFiles: () => false,
  });

export const MultiDocumentProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isElectron } = useContext(ElectronContext);
  const { filesystem, versionedDocumentStore, versionedProjectStore } =
    useContext(InfrastructureAdaptersContext);
  const [projectId, setProjectId] = useState<VersionControlId | null>(null);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [directoryFiles, setDirectoryFiles] = useState<Array<File>>([]);

  const canCreateDocument = useCallback(
    () => Boolean(directory && directory.permissionState === 'granted'),
    [directory]
  );

  const canShowFiles = useCallback(
    () => Boolean(directory && directory.permissionState === 'granted'),
    [directory]
  );

  useEffect(() => {
    const getSelectedDirectory = async () => {
      // Check if we have a project ID in the browser storage
      const browserStorageBrowserDataValue = localStorage.getItem(
        BROWSER_STORAGE_PROJECT_DATA_KEY
      );
      const browserStorageProjectData = browserStorageBrowserDataValue
        ? (JSON.parse(
            browserStorageBrowserDataValue
          ) as BrowserStorageProjectData)
        : null;

      if (browserStorageProjectData?.directoryPath) {
        const directory = await Effect.runPromise(
          filesystem.getDirectory(browserStorageProjectData.directoryPath)
        );
        setDirectory(directory);
      }
    };

    getSelectedDirectory();
  }, []);

  useEffect(() => {
    const getFiles = async (dir: Directory) => {
      if (dir.path) {
        const files = await Effect.runPromise(
          filesystem.listDirectoryFiles(dir.path)
        );
        setDirectoryFiles(files);
      }
    };

    if (directory && directory.permissionState === 'granted') {
      getFiles(directory);
    }
  }, [directory, filesystem]);

  const requestPermissionForDirectory = async (dir: Directory) => {
    if (!dir.path) {
      throw new Error('The directory does not have a path');
    }

    return Effect.runPromise(
      filesystem.requestPermissionForDirectory(dir.path)
    );
  };

  const requestPermissionForSelectedDirectory = async () => {
    if (!directory) {
      throw new Error(
        'There is no current directory to request permissions for'
      );
    }

    const permissionState = await requestPermissionForDirectory(directory);

    if (directory) {
      setDirectory({ ...directory, permissionState });
    }
  };

  const openDirectory = async () => {
    const directory = await Effect.runPromise(filesystem.openDirectory());
    setDirectory(directory);
    return directory;
  };

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

  useEffect(() => {
    const openOrCreateProject = async () => {
      if (directory) {
        // Check if we have a project ID in the browser storage
        const browserStorageBrowserDataValue = localStorage.getItem(
          BROWSER_STORAGE_PROJECT_DATA_KEY
        );
        const browserStorageProjectData = browserStorageBrowserDataValue
          ? (JSON.parse(
              browserStorageBrowserDataValue
            ) as BrowserStorageProjectData)
          : null;

        // Perform some side effects conditionally and store the (potentially) new
        // project ID in local storage
        let projId: VersionControlId;
        if (
          browserStorageProjectData?.directoryName === directory.name &&
          browserStorageProjectData?.directoryPath === directory.path
        ) {
          // If we have a project ID and it matches the new directory name & path,
          // we already have its version control ID. Return it and set it in the state.
          projId = browserStorageProjectData.versionControlId;

          if (isElectron) {
            // Delegate opening the project to the main process
            await window.versionControlAPI.openProject({
              projectId: projId,
              directoryPath: directory.path!,
            });
          } else {
            await Effect.runPromise(
              updateProjectFromFilesystemContent({
                findDocumentById: versionedDocumentStore.findDocumentById,
                getDocumentFromHandle:
                  versionedDocumentStore.getDocumentFromHandle,
                createDocument: versionedDocumentStore.createDocument,
                deleteDocument: versionedDocumentStore.deleteDocument,
                updateDocumentSpans: versionedDocumentStore.updateDocumentSpans,
                listProjectDocuments:
                  versionedProjectStore.listProjectDocuments,
                findDocumentInProject:
                  versionedProjectStore.findDocumentInProject,
                deleteDocumentFromProject:
                  versionedProjectStore.deleteDocumentFromProject,
                addDocumentToProject:
                  versionedProjectStore.addDocumentToProject,
                listDirectoryFiles: filesystem.listDirectoryFiles,
                readFile: filesystem.readFile,
              })({
                projectId: projId,
                directoryPath: directory.path!,
              })
            );
          }
        } else {
          if (isElectron) {
            // Delegate opening/creating the project to the main process
            projId = await window.versionControlAPI.openOrCreateProject({
              directoryPath: directory.path!,
            });
          } else {
            projId = await Effect.runPromise(
              createProjectFromFilesystemContent({
                createDocument: versionedDocumentStore.createDocument,
                createProject: versionedProjectStore.createProject,
                addDocumentToProject:
                  versionedProjectStore.addDocumentToProject,
                listDirectoryFiles: filesystem.listDirectoryFiles,
                readFile: filesystem.readFile,
              })({
                directoryPath: directory.path!,
              })
            );
          }

          localStorage.setItem(
            BROWSER_STORAGE_PROJECT_DATA_KEY,
            JSON.stringify({
              directoryName: directory.name,
              directoryPath: directory.path,
              versionControlId: projId,
            })
          );
        }

        setProjectId(projId);
      } else {
        setProjectId(null);
      }
    };

    openOrCreateProject();
  }, [directory, isElectron]);

  const handleFindDocumentInProject = async (args: {
    projectId: VersionControlId;
    documentPath: string;
  }) =>
    Effect.runPromise(
      findDocumentInProject({
        findDocumentById: versionedDocumentStore.findDocumentById,
        findDocumentInProjectStore: versionedProjectStore.findDocumentInProject,
      })({
        projectId: args.projectId,
        documentPath: args.documentPath,
      })
    );

  return (
    <MultiDocumentProjectContext.Provider
      value={{
        projectId,
        directory,
        directoryFiles,
        openDirectory,
        requestPermissionForSelectedDirectory,
        createNewDocument: handleCreateNewDocument,
        findDocumentInProject: handleFindDocumentInProject,
        canCreateDocument,
        canShowFiles,
      }}
    >
      {children}
    </MultiDocumentProjectContext.Provider>
  );
};
