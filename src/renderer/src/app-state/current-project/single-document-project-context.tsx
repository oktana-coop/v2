import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router';

import { AuthContext } from '../../../../modules/auth/browser';
import {
  DEFAULT_REMOTE_PROJECT_NAME,
  DOCUMENT_INTERNAL_PATH,
  type ProjectId,
  type RemoteProjectInfo,
  type SingleDocumentProjectStore,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import {
  ElectronContext,
  isElectron,
} from '../../../../modules/infrastructure/cross-platform/browser';
import { type File } from '../../../../modules/infrastructure/filesystem';
import {
  createErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type Branch,
  type Commit,
  DEFAULT_BRANCH,
  parseBranch,
  type ResolvedArtifactId,
  urlEncodeArtifactId,
  VersionControlMergeConflictErrorTag,
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
  branchToDelete: Branch | null;
  openDeleteBranchDialog: (branch: Branch) => void;
  closeDeleteBranchDialog: () => void;
  supportsBranching: boolean;
  remoteProject: RemoteProjectInfo | null;
  addRemoteProject: (url: string) => Promise<void>;
  remoteBranchInfo: Record<Branch, Commit['id']>;
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
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [supportsBranching, setSupportsBranching] = useState<boolean>(false);
  const { dispatchNotification } = useContext(NotificationsContext);
  const { username, email } = useContext(AuthContext);
  const [remoteProject, setRemoteProject] = useState<RemoteProjectInfo | null>(
    null
  );
  const [remoteBranchInfo, setRemoteBranchInfo] = useState<
    Record<Branch, Commit['id']>
  >({});

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

  const openRecentProjectFromBrowserStorage = useCallback(async () => {
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
        remoteProjects,
        file,
        name: projName,
      } = await Effect.runPromise(
        singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
          filesystem,
        })({
          fromFile: browserStorageProjectData.file ?? undefined,
          projectId: browserStorageProjectData.projectId,
          username,
          email,
        })
      );

      setVersionedProjectStore(projectStore);
      setVersionedDocumentStore(documentStore);
      setProjectId(browserStorageProjectData.projectId);
      setDocumentId(docId);
      setProjectFile(file);
      setProjectName(projName);
      setCurrentBranch(currentBranch);
      setRemoteProject(remoteProjects.length > 0 ? remoteProjects[0] : null);

      navigate(
        `/projects/${urlEncodeProjectId(browserStorageProjectData.projectId)}/documents/${urlEncodeArtifactId(docId)}`
      );
    }

    setLoading(false);
  }, [singleDocumentProjectStoreManager, username, email]);

  const handleCreateNewDocument = useCallback(
    async (name?: string) => {
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
        remoteProjects,
        file,
        name: projName,
      } = await Effect.runPromise(
        singleDocumentProjectStoreManager.setupSingleDocumentProjectStore({
          filesystem,
        })({ name, username, email })
      );

      setVersionedProjectStore(projectStore);
      setVersionedDocumentStore(documentStore);
      setProjectId(projId);
      setDocumentId(docId);
      setProjectFile(file);
      setProjectName(projName);
      setCurrentBranch(currentBranch);
      setRemoteProject(remoteProjects.length > 0 ? remoteProjects[0] : null);

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
    },
    [singleDocumentProjectStoreManager, username, email]
  );

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
          remoteProjects,
          file,
          name: projName,
        } = await Effect.runPromise(
          args
            ? singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
                filesystem,
              })({
                fromFile: args.fromFile,
                projectId: args.projectId,
                username,
                email,
              })
            : singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
                filesystem,
              })({ username, email })
        );

        setVersionedProjectStore(projectStore);
        setVersionedDocumentStore(documentStore);
        setProjectId(projId);
        setDocumentId(docId);
        setProjectFile(file);
        setProjectName(projName);
        setCurrentBranch(currentBranch);
        setRemoteProject(remoteProjects.length > 0 ? remoteProjects[0] : null);

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

  useEffect(() => {
    if (versionedProjectStore) {
      setSupportsBranching(versionedProjectStore.supportsBranching);
    }
  }, [versionedProjectStore]);

  useEffect(() => {
    const fetchRemoteBranchInfo = async ({
      versionedProjectStore,
      projectId,
      remoteProject,
    }: {
      versionedProjectStore: SingleDocumentProjectStore;
      projectId: ProjectId;
      remoteProject: RemoteProjectInfo;
    }) => {
      const branchInfo = await Effect.runPromise(
        versionedProjectStore.getRemoteBranchInfo({
          projectId,
          remoteName: remoteProject.name,
        })
      );

      setRemoteBranchInfo(branchInfo);
    };

    if (versionedProjectStore && projectId && remoteProject) {
      fetchRemoteBranchInfo({
        versionedProjectStore,
        projectId,
        remoteProject,
      });
    }
  }, [versionedProjectStore, projectId, remoteProject]);

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

      setBranchToDelete(null);
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

      const { notification } = await Effect.runPromise(
        pipe(
          pipe(
            versionedProjectStore.mergeAndDeleteBranch({
              projectId,
              from: branch,
              into: DEFAULT_BRANCH as Branch,
            }),
            Effect.map((lastCommitId) => ({
              result: lastCommitId,
              notification: null,
            }))
          ),
          Effect.catchTag(VersionControlMergeConflictErrorTag, (err) => {
            console.error(err);
            const notification = createErrorNotification({
              title: 'Merge Conflict',
              message:
                'A conflict was encountered when v2 tried to merge the branch. Conflict resolution workflow coming soon.',
            });

            return Effect.succeed({ result: null, notification });
          }),
          Effect.catchAll((err) => {
            console.error(err);
            const notification = createErrorNotification({
              title: 'Merge Error',
              message: `An error happened when trying to merge "${branch}" into "${DEFAULT_BRANCH}" branch`,
            });

            return Effect.succeed({ result: null, notification });
          })
        )
      );

      if (notification) {
        dispatchNotification(notification);
      }

      setCurrentBranch(DEFAULT_BRANCH as Branch);
    },
    [versionedProjectStore, projectId, dispatchNotification]
  );

  const handleOpenDeleteBranchDialog = useCallback((branch: Branch) => {
    setBranchToDelete(branch);
  }, []);

  const handleCloseDeleteBranchDialog = useCallback(() => {
    setBranchToDelete(null);
  }, []);

  useEffect(() => {
    const updateAuthorInfoInProjectStore = async ({
      versionedProjectStore,
      projectId,
    }: {
      versionedProjectStore: SingleDocumentProjectStore;
      projectId: ProjectId;
    }) => {
      versionedProjectStore.setAuthorInfo({
        projectId,
        username,
        email,
      });
    };

    if (versionedProjectStore && projectId) {
      updateAuthorInfoInProjectStore({
        versionedProjectStore,
        projectId,
      });
    }
  }, [username, email, versionedProjectStore, projectId]);

  const handleAddRemoteProject = useCallback(
    async (url: string) => {
      if (!versionedProjectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot add remote project.'
        );
      }

      const { notification, result } = await Effect.runPromise(
        pipe(
          pipe(
            versionedProjectStore.addRemoteProject({
              projectId,
              remoteName: DEFAULT_REMOTE_PROJECT_NAME,
              remoteUrl: url,
            }),
            Effect.map(() => ({
              result: {
                name: DEFAULT_REMOTE_PROJECT_NAME,
                url,
              },
              notification: null,
            }))
          ),
          Effect.catchAll((err) => {
            console.error(err);
            const notification = createErrorNotification({
              title: 'Remote Project Error',
              message: `An error happened when trying to connect the remote project.`,
            });

            return Effect.succeed({ result: null, notification });
          })
        )
      );

      if (notification) {
        dispatchNotification(notification);
      }

      setRemoteProject(result);
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
        branchToDelete,
        openDeleteBranchDialog: handleOpenDeleteBranchDialog,
        closeDeleteBranchDialog: handleCloseDeleteBranchDialog,
        supportsBranching,
        remoteProject,
        addRemoteProject: handleAddRemoteProject,
        remoteBranchInfo,
      }}
    >
      {children}
    </SingleDocumentProjectContext.Provider>
  );
};
