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
import { type ProjectId } from '../../../../modules/domain/project';
import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type ResolvedDocument,
  richTextRepresentationExtensions,
} from '../../../../modules/domain/rich-text';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform';
import {
  type Directory,
  type File,
} from '../../../../modules/infrastructure/filesystem';
import {
  removeExtension,
  removePath,
} from '../../../../modules/infrastructure/filesystem';
import {
  type Branch,
  type ResolvedArtifactId,
} from '../../../../modules/infrastructure/version-control';
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
  currentBranch: Branch | null;
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
  }) => Promise<ResolvedDocument>;
  selectedFileInfo: SelectedFileInfo | null;
  selectedFileName: string | null;
  setSelectedFileInfo: (file: SelectedFileInfo) => void;
  clearFileSelection: () => Promise<void>;
  listBranches: () => Promise<Branch[]>;
};

export const MultiDocumentProjectContext =
  createContext<MultiDocumentProjectContextType>({
    loading: false,
    projectId: null,
    directory: null,
    branch: null,
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
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
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
          currentBranch,
        } = await Effect.runPromise(
          multiDocumentProjectStoreManager.openMultiDocumentProjectById({
            filesystem,
          })({
            projectId: browserStorageProjectData.projectId,
            directoryPath: browserStorageProjectData.directoryPath,
          })
        );

        setProjectId(browserStorageProjectData.projectId);
        setDirectory(directory);
        setCurrentBranch(currentBranch);
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
          extensions: [
            richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
          ],
          useRelativePath: true,
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
      currentBranch,
    } = await Effect.runPromise(
      multiDocumentProjectStoreManager.openOrCreateMultiDocumentProject({
        filesystem,
      })()
    );

    setProjectId(projId);
    setDirectory(dir);
    setCurrentBranch(currentBranch);
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
          getRelativePath: filesystem.getRelativePath,
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
          extensions: [
            richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
          ],
          useRelativePath: true,
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
        findDocumentById: versionedDocumentStore.findDocumentById,
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

  const handleListBranches = useCallback(async () => {
    if (!versionedProjectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot list branches'
      );
    }

    const branches = await Effect.runPromise(
      versionedProjectStore.listBranches({ projectId })
    );

    return branches;
  }, [versionedProjectStore, projectId]);

  return (
    <MultiDocumentProjectContext.Provider
      value={{
        loading,
        projectId,
        directory,
        directoryFiles,
        currentBranch,
        openDirectory: handleOpenDirectory,
        requestPermissionForSelectedDirectory,
        createNewDocument: handleCreateNewDocument,
        findDocumentInProject: handleFindDocumentInProject,
        selectedFileInfo,
        selectedFileName,
        setSelectedFileInfo: handleSetSelectedFileInfo,
        clearFileSelection,
        listBranches: handleListBranches,
      }}
    >
      {children}
    </MultiDocumentProjectContext.Provider>
  );
};
