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
  createVersionedDocument,
  DEFAULT_REMOTE_PROJECT_NAME,
  findDocumentInProject,
  type MultiDocumentProjectStore,
  type RemoteProjectInfo,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import { type ProjectId } from '../../../../modules/domain/project';
import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type ResolvedDocument,
  richTextRepresentationExtensions,
} from '../../../../modules/domain/rich-text';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import {
  type Directory,
  type File,
  removeExtension,
  removePath,
} from '../../../../modules/infrastructure/filesystem';
import {
  createErrorNotification,
  createSuccessNotification,
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

type CreateNewDocumentArgs = {
  name?: string;
};

export type MultiDocumentProjectContextType = {
  loading: boolean;
  projectId: ProjectId | null;
  directory: Directory | null;
  currentBranch: Branch | null;
  directoryFiles: Array<File>;
  openDirectory: (cloneUrl?: string) => Promise<Directory>;
  requestPermissionForSelectedDirectory: () => Promise<void>;
  createNewDocument: (args?: CreateNewDocumentArgs) => Promise<{
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
  pushToRemoteProject: () => Promise<void>;
  pullFromRemoteProject: () => Promise<void>;
  pulledUpstreamChanges: boolean;
  onHandlePulledUpstreamChanges: () => void;
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
  const { documentId: documentIdInPath } = useParams();
  const [versionedProjectStore, setVersionedProjectStore] =
    useState<MultiDocumentProjectStore | null>(null);
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<SelectedFileInfo | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isCreateBranchDialogOpen, setIsCreateBranchDialogOpen] =
    useState<boolean>(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const { dispatchNotification } = useContext(NotificationsContext);
  const [supportsBranching, setSupportsBranching] = useState<boolean>(false);
  const { username, email } = useContext(AuthContext);
  const [remoteProject, setRemoteProject] = useState<RemoteProjectInfo | null>(
    null
  );
  const [remoteBranchInfo, setRemoteBranchInfo] = useState<
    Record<Branch, Commit['id']>
  >({});
  const [pulledUpstreamChanges, setPulledUpstreamChanges] =
    useState<boolean>(false);
  const navigate = useNavigate();

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
          remoteProjects,
        } = await Effect.runPromise(
          multiDocumentProjectStoreManager.openMultiDocumentProjectById({
            filesystem,
          })({
            projectId: browserStorageProjectData.projectId,
            directoryPath: browserStorageProjectData.directoryPath,
            username,
            email,
          })
        );

        setProjectId(browserStorageProjectData.projectId);
        setDirectory(directory);
        setCurrentBranch(currentBranch);
        setRemoteProject(remoteProjects.length > 0 ? remoteProjects[0] : null);
        setVersionedProjectStore(projectStore);
        setVersionedDocumentStore(documentStore);

        setLoading(false);

        navigate(
          `/projects/${urlEncodeProjectId(browserStorageProjectData.projectId)}/documents`
        );
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
  }, [directory, filesystem, currentBranch, pulledUpstreamChanges]);

  useEffect(() => {
    const navigateToProjectsList = () => {
      const newUrl = `/projects`;
      setPulledUpstreamChanges(false);
      navigate(newUrl);
    };

    const reloadSelectedDocumentOrReset = async ({
      projId,
      selectedFilePath,
    }: {
      projId: ProjectId;
      selectedFilePath: string;
    }) => {
      try {
        const doc = await handleFindDocumentInProject({
          projectId: projId,
          documentPath: selectedFilePath,
        });

        setSelectedFileInfo({ documentId: doc.id, path: selectedFilePath });

        const newUrl = `/projects/${urlEncodeProjectId(projId)}/documents/${urlEncodeArtifactId(doc.id)}?path=${encodeURIComponent(selectedFilePath)}`;
        setPulledUpstreamChanges(false);
        navigate(newUrl);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        // TODO: Only do this on NotFoundError.
        // TODO: Navigate to the specific project route (doesn't exist at the time of writing) this.
        navigateToProjectsList();
      }
    };

    if (projectId && selectedFileInfo?.path) {
      if (selectedFileInfo) {
        reloadSelectedDocumentOrReset({
          projId: projectId,
          selectedFilePath: selectedFileInfo.path,
        });
      } else {
        // TODO: Navigate to the specific project route (doesn't exist at the time of writing) this.
        navigateToProjectsList();
      }
    }
  }, [currentBranch, pulledUpstreamChanges]);

  useEffect(() => {
    if (!documentIdInPath) {
      clearFileSelection();
    }
  }, [documentIdInPath]);

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

  useEffect(() => {
    const fetchRemoteBranchInfo = async ({
      versionedProjectStore,
      projectId,
      remoteProject,
    }: {
      versionedProjectStore: MultiDocumentProjectStore;
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

  const handleOpenDirectory = useCallback(
    async (cloneUrl?: string) => {
      setLoading(true);

      const {
        versionedDocumentStore: documentStore,
        versionedProjectStore: projectStore,
        projectId: projId,
        directory: dir,
        currentBranch,
        remoteProjects,
      } = await Effect.runPromise(
        multiDocumentProjectStoreManager.openOrCreateMultiDocumentProject({
          filesystem,
        })({ username, email, cloneUrl })
      );

      setProjectId(projId);
      setDirectory(dir);
      setCurrentBranch(currentBranch);
      setRemoteProject(remoteProjects.length > 0 ? remoteProjects[0] : null);
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

      navigate(`/projects/${urlEncodeProjectId(projId)}/documents`);

      return dir;
    },
    [multiDocumentProjectStoreManager, username, email]
  );

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

  useEffect(() => {
    if (versionedProjectStore) {
      setSupportsBranching(versionedProjectStore.supportsBranching);
    }
  }, [versionedProjectStore]);

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
    [versionedProjectStore, projectId]
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
      versionedProjectStore: MultiDocumentProjectStore;
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

  const handlePushToRemoteProject = useCallback(async () => {
    if (!versionedProjectStore || !projectId || !remoteProject) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot push to remote project.'
      );
    }

    try {
      await Effect.runPromise(
        versionedProjectStore.pushToRemoteProject({
          projectId,
          remoteName: remoteProject.name,
        })
      );

      const notification = createSuccessNotification({
        title: 'Push Successful',
        message: `Changes have been successfully pushed to the remote project.`,
      });
      dispatchNotification(notification);
    } catch (err) {
      console.error(err);

      const notification = createErrorNotification({
        title: 'Push Error',
        message: `An error happened when trying to push to the remote project.`,
      });
      dispatchNotification(notification);
    }
  }, [versionedProjectStore, projectId, remoteProject]);

  const handlePullFromRemoteProject = useCallback(async () => {
    if (!versionedProjectStore || !projectId || !remoteProject) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot pull from remote project.'
      );
    }

    try {
      await Effect.runPromise(
        versionedProjectStore.pullFromRemoteProject({
          projectId,
          remoteName: remoteProject.name,
        })
      );

      setPulledUpstreamChanges(true);
    } catch (err) {
      console.error(err);

      const notification = createErrorNotification({
        title: 'Pull Error',
        message: `An error happened when trying to pull changes from the remote project.`,
      });
      dispatchNotification(notification);
    }
  }, [versionedProjectStore, projectId, remoteProject]);

  const resetPulledUpstreamChanges = () => {
    setPulledUpstreamChanges(false);
  };

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
        pushToRemoteProject: handlePushToRemoteProject,
        pullFromRemoteProject: handlePullFromRemoteProject,
        pulledUpstreamChanges,
        onHandlePulledUpstreamChanges: resetPulledUpstreamChanges,
      }}
    >
      {children}
    </MultiDocumentProjectContext.Provider>
  );
};
