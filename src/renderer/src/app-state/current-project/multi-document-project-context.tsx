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
} from '../../../../modules/domain/project';
import {
  type ProjectId,
  RICH_TEXT_FILE_EXTENSION,
} from '../../../../modules/domain/project';
import { VersionedDocumentHandle } from '../../../../modules/domain/rich-text';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform';
import {
  type Directory,
  type File,
} from '../../../../modules/infrastructure/filesystem';
import {
  removeExtension,
  removePath,
} from '../../../../modules/infrastructure/filesystem';
import { type ResolvedArtifactId } from '../../../../modules/infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';

type BrowserStorageProjectData = {
  directoryName: Directory['name'];
  directoryPath: Directory['path'];
  projectId: ProjectId;
};

const BROWSER_STORAGE_PROJECT_DATA_KEY = 'multi-document-project';

export type SelectedFileInfo = {
  documentId: ResolvedArtifactId;
  path: string | null;
};

export type MultiDocumentProjectContextType = {
  loading: boolean;
  projectId: ProjectId | null;
  directory: Directory | null;
  directoryFiles: Array<File>;
  openDirectory: () => Promise<Directory>;
  requestPermissionForSelectedDirectory: () => Promise<void>;
  createNewDocument: (name?: string) => Promise<{
    projectId: ProjectId;
    documentId: ResolvedArtifactId;
    path: string;
  }>;
  findDocumentInProject: (args: {
    projectId: ProjectId;
    documentPath: string;
  }) => Promise<VersionedDocumentHandle>;
  selectedFileInfo: SelectedFileInfo | null;
  selectedFileName: string | null;
  setSelectedFileInfo: (file: SelectedFileInfo) => void;
  clearFileSelection: () => Promise<void>;
};

export const MultiDocumentProjectContext =
  createContext<MultiDocumentProjectContextType>({
    loading: false,
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
    selectedFileInfo: null,
    selectedFileName: null,
    setSelectedFileInfo: async () => {},
    clearFileSelection: async () => {},
  });

export const MultiDocumentProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isElectron } = useContext(ElectronContext);
  const {
    filesystem,
    versionedDocumentStore,
    multiDocumentProjectStoreManager,
    setVersionedDocumentStore,
  } = useContext(InfrastructureAdaptersContext);
  const [loading, setLoading] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<ProjectId | null>(null);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [directoryFiles, setDirectoryFiles] = useState<Array<File>>([]);
  const [versionedProjectStore, setVersionedProjectStore] =
    useState<MultiDocumentProjectStore | null>(null);
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<SelectedFileInfo | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

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
        setLoading(true);

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

        setLoading(false);
      }
    };

    getSelectedDirectory();
  }, []);

  useEffect(() => {
    const getFiles = async (dir: Directory) => {
      const files = await Effect.runPromise(
        filesystem.listDirectoryFiles({
          path: dir.path,
          extensions: [RICH_TEXT_FILE_EXTENSION],
        })
      );
      setDirectoryFiles(files);
    };

    if (directory && directory.permissionState === 'granted') {
      getFiles(directory);
    }
  }, [directory, filesystem]);

  const requestPermissionForDirectory = async (dir: Directory) =>
    Effect.runPromise(filesystem.requestPermissionForDirectory(dir.path));

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
    setLoading(true);

    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
      projectId: projId,
      directory: dir,
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
    setDirectory(dir);
    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);

    localStorage.setItem(
      BROWSER_STORAGE_PROJECT_DATA_KEY,
      JSON.stringify({
        directoryName: dir.name,
        directoryPath: dir.path,
        projectId: projId,
      })
    );

    setLoading(false);

    return dir;
  };

  const handleCreateNewDocument = useCallback(async () => {
    if (!versionedDocumentStore || !versionedProjectStore || !projectId) {
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

    return { projectId, documentId: newDocumentId, path: newFilePath };
  }, [versionedDocumentStore, versionedProjectStore]);

  const handleFindDocumentInProject = async (args: {
    projectId: ProjectId;
    documentPath: string;
  }) => {
    if (!versionedDocumentStore || !versionedProjectStore) {
      throw new Error(
        'Cannot create document. Document and project store have not been initialized yet.'
      );
    }

    return Effect.runPromise(
      findDocumentInProject({
        findDocumentHandleById: versionedDocumentStore.findDocumentHandleById,
        findDocumentInProjectStore: versionedProjectStore.findDocumentInProject,
      })({
        projectId: args.projectId,
        documentPath: args.documentPath,
      })
    );
  };

  const clearFileSelection = async () => {
    setSelectedFileInfo(null);
  };

  const handleSetSelectedFileInfo = async ({
    documentId,
    path,
  }: SelectedFileInfo) => {
    if (isElectron) {
      window.electronAPI.sendCurrentDocumentId(documentId);
    }

    setSelectedFileInfo({
      documentId,
      path: path,
    });
  };

  useEffect(() => {
    if (selectedFileInfo && selectedFileInfo.path) {
      const fullFileName = removePath(selectedFileInfo.path);
      const cleanFileName = removeExtension(fullFileName);
      setSelectedFileName(cleanFileName);
    }
  }, [selectedFileInfo]);

  return (
    <MultiDocumentProjectContext.Provider
      value={{
        loading,
        projectId,
        directory,
        directoryFiles,
        openDirectory: handleOpenDirectory,
        requestPermissionForSelectedDirectory,
        createNewDocument: handleCreateNewDocument,
        findDocumentInProject: handleFindDocumentInProject,
        selectedFileInfo,
        selectedFileName,
        setSelectedFileInfo: handleSetSelectedFileInfo,
        clearFileSelection,
      }}
    >
      {children}
    </MultiDocumentProjectContext.Provider>
  );
};
