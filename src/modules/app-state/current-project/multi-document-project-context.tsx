import * as Effect from 'effect/Effect';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  createVersionedDocument,
  findDocumentInProject,
  type MultiDocumentProjectStore,
} from '../../domain/project';
import { RICH_TEXT_FILE_EXTENSION } from '../../domain/project/constants/file-extensions';
import { VersionedDocumentHandle } from '../../domain/rich-text';
import { type Directory, type File } from '../../infrastructure/filesystem';
import { VersionControlId } from '../../infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';

type BrowserStorageProjectData = {
  directoryName: Directory['name'];
  directoryPath: Directory['path'];
  projectId: VersionControlId;
};

const BROWSER_STORAGE_PROJECT_DATA_KEY = 'multi-document-project';

export type MultiDocumentProjectContextType = {
  projectId: VersionControlId | null;
  directory: Directory | null;
  directoryFiles: Array<File>;
  openDirectory: () => Promise<Directory>;
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
    // @ts-expect-error will get overriden below
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
  const {
    filesystem,
    versionedDocumentStore,
    multiDocumentProjectStoreManager,
    setVersionedDocumentStore,
  } = useContext(InfrastructureAdaptersContext);
  const [projectId, setProjectId] = useState<VersionControlId | null>(null);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [directoryFiles, setDirectoryFiles] = useState<Array<File>>([]);
  const [versionedProjectStore, setVersionedProjectStore] =
    useState<MultiDocumentProjectStore | null>(null);

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

      if (
        browserStorageProjectData?.directoryPath &&
        browserStorageProjectData?.projectId
      ) {
        const {
          versionedDocumentStore: documentStore,
          versionedProjectStore: projectStore,
          directory,
        } = await Effect.runPromise(
          multiDocumentProjectStoreManager.openMultiDocumentProjectById({
            listDirectoryFiles: filesystem.listDirectoryFiles,
            readFile: filesystem.readFile,
            getDirectory: filesystem.getDirectory,
          })({
            projectId: browserStorageProjectData.projectId,
            directoryPath: browserStorageProjectData.directoryPath,
          })
        );

        setProjectId(browserStorageProjectData.projectId);
        setDirectory(directory);
        setVersionedProjectStore(projectStore);
        setVersionedDocumentStore(documentStore);
      }
    };

    getSelectedDirectory();
  }, []);

  useEffect(() => {
    const getFiles = async (dir: Directory) => {
      if (dir.path) {
        const files = await Effect.runPromise(
          filesystem.listDirectoryFiles({
            path: dir.path,
            extensions: [RICH_TEXT_FILE_EXTENSION],
          })
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

  const handleOpenDirectory = async () => {
    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
      projectId: projId,
      directory,
    } = await Effect.runPromise(
      multiDocumentProjectStoreManager.openOrCreateMultiDocumentProject({
        openDirectory: filesystem.openDirectory,
        listDirectoryFiles: filesystem.listDirectoryFiles,
        readFile: filesystem.readFile,
        writeFile: filesystem.writeFile,
        assertWritePermissionForDirectory:
          filesystem.assertWritePermissionForDirectory,
      })()
    );

    setProjectId(projId);
    setDirectory(directory);
    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);

    localStorage.setItem(
      BROWSER_STORAGE_PROJECT_DATA_KEY,
      JSON.stringify({
        directoryName: directory.name,
        directoryPath: directory.path,
        projectId: projId,
      })
    );

    return directory;
  };

  const handleCreateNewDocument = async (suggestedName: string) => {
    if (!versionedDocumentStore || !versionedProjectStore) {
      throw new Error(
        'Cannot create document. Document and project store have not been initialized yet.'
      );
    }

    const { documentId: newDocumentId, filePath: newFilePath } =
      await Effect.runPromise(
        createVersionedDocument({
          createNewFile: filesystem.createNewFile,
          createDocument: versionedDocumentStore.createDocument,
          addDocumentToProject: versionedProjectStore.addDocumentToProject,
        })({
          suggestedName: suggestedName,
          projectId,
          content: null,
          directory,
        })
      );

    // Refresh directory files if a directory is selected
    if (
      directory &&
      directory.permissionState === 'granted' &&
      directory.path
    ) {
      const files = await Effect.runPromise(
        filesystem.listDirectoryFiles({
          path: directory.path,
          extensions: [RICH_TEXT_FILE_EXTENSION],
        })
      );
      setDirectoryFiles(files);
    }

    return { documentId: newDocumentId, path: newFilePath };
  };

  const handleFindDocumentInProject = async (args: {
    projectId: VersionControlId;
    documentPath: string;
  }) => {
    if (!versionedDocumentStore || !versionedProjectStore) {
      throw new Error(
        'Cannot create document. Document and project store have not been initialized yet.'
      );
    }

    return Effect.runPromise(
      findDocumentInProject({
        findDocumentById: versionedDocumentStore.findDocumentById,
        findDocumentInProjectStore: versionedProjectStore.findDocumentInProject,
      })({
        projectId: args.projectId,
        documentPath: args.documentPath,
      })
    );
  };

  return (
    <MultiDocumentProjectContext.Provider
      value={{
        projectId,
        directory,
        directoryFiles,
        openDirectory: handleOpenDirectory,
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
