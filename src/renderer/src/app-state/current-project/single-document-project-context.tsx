import * as Effect from 'effect/Effect';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  DOCUMENT_INTERNAL_PATH,
  type ProjectId,
  type SingleDocumentProjectStore,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform';
import { isElectron } from '../../../../modules/infrastructure/cross-platform/utils';
import { type File } from '../../../../modules/infrastructure/filesystem';
import {
  type Branch,
  DEFAULT_BRANCH,
  parseBranch,
  type ResolvedArtifactId,
  urlEncodeArtifactId,
  versionControlSystems,
} from '../../../../modules/infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';

export type BrowserStorageProjectData = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
  file: File | null;
};

export const BROWSER_STORAGE_PROJECT_DATA_KEY = 'single-document-project';

export type SingleDocumentProjectContextType = {
  loading: boolean;
  projectId: ProjectId | null;
  documentId: ResolvedArtifactId | null;
  documentInternalPath: string | null;
  projectFile: File | null;
  projectName: string | null;
  currentBranch: Branch | null;
  versionedProjectStore: SingleDocumentProjectStore | null;
  createNewDocument: (name?: string) => Promise<{
    projectId: ProjectId;
    documentId: ResolvedArtifactId;
    path: string | null;
  }>;
  openDocument: (args?: { fromFile?: File; projectId?: ProjectId }) => Promise<{
    projectId: ProjectId | null;
    documentId: ResolvedArtifactId | null;
    path: string | null;
  }>;
  listBranches: () => Promise<Branch[]>;
  createAndSwitchToBranch: (branchName: string) => Promise<void>;
  switchToBranch: (branch: Branch) => Promise<void>;
  isCreateBranchDialogOpen: boolean;
  openCreateBranchDialog: () => void;
  closeCreateBranchDialog: () => void;
  deleteBranch: (branch: Branch) => Promise<void>;
  mergeAndDeleteBranch: (branch: Branch) => Promise<void>;
};

export const SingleDocumentProjectContext =
  createContext<SingleDocumentProjectContextType>({
    loading: false,
    projectId: null,
    documentId: null,
    documentInternalPath: null,
    projectFile: null,
    projectName: null,
    // @ts-expect-error will get overriden below
    createNewDocument: () => null,
    // @ts-expect-error will get overriden below
    openDocument: () => null,
    versionedProjectStore: null,
    isCreateBranchDialogOpen: false,
  });

const getFileToBeOpenedFromSessionStorage = (): File | null => {
  const fileToBeOpened = sessionStorage.getItem('fileToBeOpened');

  if (fileToBeOpened) {
    try {
      const parsedFile = JSON.parse(fileToBeOpened) as File;
      return parsedFile;
    } catch {
      console.error('Error parsing file to be opened from session storage');
    }
  }

  return null;
};

export const SingleDocumentProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const {
    filesystem,
    singleDocumentProjectStoreManager,
    setVersionedDocumentStore,
  } = useContext(InfrastructureAdaptersContext);
  const { config } = useContext(ElectronContext);
  const [loading, setLoading] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<ProjectId | null>(null);
  const [documentId, setDocumentId] = useState<ResolvedArtifactId | null>(null);
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [versionedProjectStore, setVersionedProjectStore] =
    useState<SingleDocumentProjectStore | null>(null);
  const [fileToBeOpened, setFileToBeOpened] = useState<File | null>(null);
  const navigate = useNavigate();
  const { projectId: projectIdInPath } = useParams();
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [isCreateBranchDialogOpen, setIsCreateBranchDialogOpen] =
    useState<boolean>(false);

  const documentInternalPath =
    versionControlSystems[config.singleDocumentProjectVersionControlSystem] ===
    versionControlSystems.GIT
      ? DOCUMENT_INTERNAL_PATH
      : null;

  useEffect(() => {
    if (!isElectron()) {
      return;
    }

    setFileToBeOpened(getFileToBeOpenedFromSessionStorage());

    const unsubscribe = window.osEventsAPI.onOpenFileFromFilesystem(
      (file: File) => {
        setFileToBeOpened(file);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const openAndSelectFileFromOsEvent = async (file: File) => {
      const openedDocument = await handleOpenDocument({ fromFile: file });
      setLoading(false);

      if (openedDocument.projectId && openedDocument.documentId) {
        navigate(
          `/projects/${urlEncodeProjectId(openedDocument.projectId)}/documents/${urlEncodeArtifactId(openedDocument.documentId)}`
        );
      }
    };

    if (fileToBeOpened) {
      openAndSelectFileFromOsEvent(fileToBeOpened);
    } else {
      openRecentProjectFromBrowserStorage();
    }
  }, [fileToBeOpened, currentBranch]);

  const openRecentProjectFromBrowserStorage = async () => {
    setLoading(true);
    // Check if we have a project ID in the browser storage
    const browserStorageBrowserDataValue = localStorage.getItem(
      BROWSER_STORAGE_PROJECT_DATA_KEY
    );
    const browserStorageProjectData = browserStorageBrowserDataValue
      ? (JSON.parse(
          browserStorageBrowserDataValue
        ) as BrowserStorageProjectData)
      : null;

    if (browserStorageProjectData?.projectId) {
      const {
        versionedDocumentStore: documentStore,
        versionedProjectStore: projectStore,
        documentId: docId,
        currentBranch,
        file,
        name: projName,
      } = await Effect.runPromise(
        singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
          filesystem,
        })({
          fromFile: browserStorageProjectData.file ?? undefined,
          projectId: browserStorageProjectData.projectId,
        })
      );

      setVersionedProjectStore(projectStore);
      setVersionedDocumentStore(documentStore);
      setProjectId(browserStorageProjectData.projectId);
      setDocumentId(docId);
      setProjectFile(file);
      setProjectName(projName);
      setCurrentBranch(currentBranch);

      navigate(
        `/projects/${urlEncodeProjectId(browserStorageProjectData.projectId)}/documents/${urlEncodeArtifactId(docId)}`
      );
    }

    setLoading(false);
  };

  const handleCreateNewDocument = async (name?: string) => {
    if (versionedProjectStore) {
      await Effect.runPromise(versionedProjectStore.disconnect());

      setVersionedProjectStore(null);
      setVersionedDocumentStore(null);
    }

    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
      projectId: projId,
      documentId: docId,
      currentBranch,
      file,
      name: projName,
    } = await Effect.runPromise(
      singleDocumentProjectStoreManager.setupSingleDocumentProjectStore({
        filesystem,
      })({ name })
    );

    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);
    setProjectId(projId);
    setDocumentId(docId);
    setProjectFile(file);
    setProjectName(projName);
    setCurrentBranch(currentBranch);

    const browserStorageProjectData: BrowserStorageProjectData = {
      projectId: projId,
      documentId: docId,
      file,
    };
    localStorage.setItem(
      BROWSER_STORAGE_PROJECT_DATA_KEY,
      JSON.stringify(browserStorageProjectData)
    );

    return { projectId: projId, documentId: docId, path: file?.path ?? null };
  };

  const handleOpenDocument = useCallback(
    async (args?: {
      fromFile?: File;
      projectId?: ProjectId;
      forceOpen?: boolean;
    }) => {
      try {
        // Check if document (and project) is already opened
        if (
          !args?.forceOpen &&
          args?.projectId &&
          projectId &&
          documentId &&
          projectIdInPath &&
          projectId === projectIdInPath
        ) {
          return { projectId, documentId, path: projectFile?.path ?? null };
        }

        setLoading(true);

        if (versionedProjectStore) {
          await Effect.runPromise(versionedProjectStore.disconnect());

          setVersionedProjectStore(null);
          setVersionedDocumentStore(null);
        }

        const {
          versionedDocumentStore: documentStore,
          versionedProjectStore: projectStore,
          projectId: projId,
          documentId: docId,
          currentBranch,
          file,
          name: projName,
        } = await Effect.runPromise(
          args
            ? singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
                filesystem,
              })({ fromFile: args.fromFile, projectId: args.projectId })
            : singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
                filesystem,
              })({})
        );

        setVersionedProjectStore(projectStore);
        setVersionedDocumentStore(documentStore);
        setProjectId(projId);
        setDocumentId(docId);
        setProjectFile(file);
        setProjectName(projName);
        setCurrentBranch(currentBranch);

        const browserStorageProjectData: BrowserStorageProjectData = {
          projectId: projId,
          documentId: docId,
          file,
        };
        localStorage.setItem(
          BROWSER_STORAGE_PROJECT_DATA_KEY,
          JSON.stringify(browserStorageProjectData)
        );

        setLoading(false);

        return {
          projectId: projId,
          documentId: docId,
          path: file?.path ?? null,
        };
      } catch {
        // Restore previous state if opening failed
        if (
          projectId &&
          documentId &&
          projectIdInPath &&
          projectId === projectIdInPath
        ) {
          return handleOpenDocument({
            projectId,
            fromFile: projectFile ?? undefined,
            forceOpen: true,
          });
        } else {
          return { projectId: null, documentId: null, path: null };
        }
      }
    },
    [projectIdInPath]
  );

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

  const handleCreateAndSwitchToBranch = useCallback(
    async (branchName: string) => {
      if (!versionedProjectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot create branch.'
        );
      }

      let branch: Branch;
      try {
        branch = parseBranch(branchName);
      } catch (err) {
        console.error(err);
        throw new Error('Invalid branch name');
      }

      await Effect.runPromise(
        versionedProjectStore.createAndSwitchToBranch({ projectId, branch })
      );

      setCurrentBranch(branch);
      setIsCreateBranchDialogOpen(false);
    },
    [versionedProjectStore, projectId]
  );

  const handleSwitchToBranch = useCallback(
    async (branch: Branch) => {
      if (!versionedProjectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot create branch.'
        );
      }

      await Effect.runPromise(
        versionedProjectStore.switchToBranch({ projectId, branch })
      );

      setCurrentBranch(branch);
    },
    [versionedProjectStore, projectId]
  );

  const handleOpenCreateBranchDialog = useCallback(() => {
    setIsCreateBranchDialogOpen(true);
  }, []);

  const handleCloseCreateBranchDialog = useCallback(() => {
    setIsCreateBranchDialogOpen(false);
  }, []);

  const handleDeleteBranch = useCallback(
    async (branch: Branch) => {
      if (!versionedProjectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot delete branch.'
        );
      }

      const { currentBranch: resultingCurrentBranch } = await Effect.runPromise(
        versionedProjectStore.deleteBranch({ projectId, branch })
      );

      setCurrentBranch(resultingCurrentBranch);
    },
    [versionedProjectStore, projectId]
  );

  const handleMergeAndDeleteBranch = useCallback(
    async (branch: Branch) => {
      if (!versionedProjectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot delete branch.'
        );
      }

      await Effect.runPromise(
        versionedProjectStore.mergeAndDeleteBranch({
          projectId,
          from: branch,
          into: DEFAULT_BRANCH as Branch,
        })
      );

      setCurrentBranch(DEFAULT_BRANCH as Branch);
    },
    [versionedProjectStore, projectId]
  );

  return (
    <SingleDocumentProjectContext.Provider
      value={{
        loading,
        projectId,
        documentId,
        documentInternalPath,
        projectFile,
        projectName,
        currentBranch,
        versionedProjectStore,
        createNewDocument: handleCreateNewDocument,
        openDocument: handleOpenDocument,
        listBranches: handleListBranches,
        createAndSwitchToBranch: handleCreateAndSwitchToBranch,
        switchToBranch: handleSwitchToBranch,
        isCreateBranchDialogOpen,
        openCreateBranchDialog: handleOpenCreateBranchDialog,
        closeCreateBranchDialog: handleCloseCreateBranchDialog,
        deleteBranch: handleDeleteBranch,
        mergeAndDeleteBranch: handleMergeAndDeleteBranch,
      }}
    >
      {children}
    </SingleDocumentProjectContext.Provider>
  );
};
