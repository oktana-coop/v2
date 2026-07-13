import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { AuthContext } from '../../../../modules/auth/browser';
import {
  type ArtifactTreeNode,
  createDocumentInProject,
  DEFAULT_REMOTE_PROJECT_NAME,
  findNodeByPath,
  isPathInsideDirectory,
  parseProjectRelPath,
  type ProjectStore,
  type RemoteProjectInfo,
  renameDocumentInProject,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import { type ProjectId } from '../../../../modules/domain/project';
import { type ResolvedDocument } from '../../../../modules/domain/rich-text';
import {
  EXPLORER_TREE_DIRECTORY,
  EXPLORER_TREE_FILE,
} from '../../../../modules/infrastructure/cross-platform';
import {
  type Directory,
  FilesystemAlreadyExistsErrorTag,
  removeExtension,
  removePath,
} from '../../../../modules/infrastructure/filesystem';
import {
  createErrorNotification,
  createInfoNotification,
  createSuccessNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type ArtifactId,
  type Branch,
  type ChangedDocument,
  type ChangeId,
  type Commit,
  DEFAULT_BRANCH,
  type MergeConflictInfo,
  parseBranch,
  UNCOMMITTED_CHANGE_ID,
  urlEncodeArtifactId,
  VersionControlMergeConflictErrorTag,
} from '../../../../modules/infrastructure/version-control';
import { useNavigateToResolveConflicts } from '../../hooks';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
import {
  type BrowserStorageProjectData,
  PROJECT_BROWSER_STORAGE_KEY,
} from './browser-storage';

export type SelectedFileInfo = {
  documentId: ArtifactId;
  // TODO: make this a ProjectRelPath
  path: string | null;
};

type CreateNewDocumentArgs = {
  name?: string;
  parentPath?: string;
};

type PendingNewDirectory = {
  parentPath?: string;
};

export type ProjectContextType = {
  loading: boolean;
  projectId: ProjectId | null;
  directory: Directory | null;
  currentBranch: Branch | null;
  projectStore: ProjectStore | null;
  directoryTree: ArtifactTreeNode[];
  refreshDirectoryTree: () => Promise<void>;
  openDirectory: (cloneUrl?: string) => Promise<Directory>;
  requestPermissionForSelectedDirectory: () => Promise<void>;
  createNewDocument: (args?: CreateNewDocumentArgs) => Promise<{
    projectId: ProjectId;
    documentId: ArtifactId;
    path: string;
  } | null>;
  findDocumentInProject: (args: {
    projectId: ProjectId;
    documentPath: string;
    changeId?: ChangeId;
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
  abortMerge: () => Promise<void>;
  refreshConflictsAndMergeIfPossible: () => Promise<void>;
  resolveConflictByKeepingDocument: (documentId: ArtifactId) => Promise<void>;
  resolveConflictByDeletingDocument: (documentId: ArtifactId) => Promise<void>;
  branchToDelete: Branch | null;
  openDeleteBranchDialog: (branch: Branch) => void;
  closeDeleteBranchDialog: () => void;
  supportsBranching: boolean;
  supportsSync: boolean;
  mergeConflictInfo: MergeConflictInfo | null;
  remoteProject: RemoteProjectInfo | null;
  addRemoteProject: (url: string) => Promise<void>;
  remoteBranchInfo: Record<Branch, Commit['id']>;
  pushToRemoteProject: () => Promise<void>;
  pullFromRemoteProject: () => Promise<void>;
  pulledUpstreamChanges: boolean;
  onHandlePulledUpstreamChanges: () => void;
  pendingNewDirectory: PendingNewDirectory | null;
  startCreateDirectory: (parentPath?: string) => void;
  createDirectory: (name: string) => Promise<void>;
  cancelCreateDirectory: () => void;
  filePathToDelete: string | null;
  startDeleteDocument: (path: string) => void;
  deleteDocument: (args: { relativePath: string }) => Promise<void>;
  confirmDeleteDocument: () => void;
  cancelDeleteDocument: () => void;
  directoryPathToDelete: string | null;
  startDeleteDirectory: (path: string) => void;
  deleteDirectory: (args: { relativePath: string }) => Promise<void>;
  confirmDeleteDirectory: () => void;
  cancelDeleteDirectory: () => void;
  filePathToRename: string | null;
  startRenameDocument: (path: string) => void;
  renameDocumentError: string | null;
  clearRenameDocumentError: () => void;
  renameDocument: (args: {
    oldRelativePath: string;
    newName: string;
  }) => Promise<void>;
  cancelRenameDocument: () => void;
  directoryPathToRename: string | null;
  startRenameDirectory: (path: string) => void;
  renameDirectoryError: string | null;
  clearRenameDirectoryError: () => void;
  renameDirectory: (args: {
    oldRelativePath: string;
    newName: string;
  }) => Promise<void>;
  cancelRenameDirectory: () => void;
  getProjectHistory: () => Promise<Commit[]>;
  getProjectChangedDocuments: (
    changeId: Commit['id']
  ) => Promise<ChangedDocument[]>;
  getProjectUncommittedChanges: () => Promise<ChangedDocument[]>;
  commitChanges: (message: string) => Promise<void>;
  commitDocumentChanges: (args: {
    documentId: ArtifactId;
    message: string;
  }) => Promise<void>;
  restoreDocumentChanges: (args: {
    documentId: ArtifactId;
    commit: Commit;
    message?: string;
  }) => Promise<Commit['id']>;
};

export const ProjectContext = createContext<ProjectContextType>({
  loading: false,
  projectId: null,
  directory: null,
  currentBranch: null,
  projectStore: null,
  directoryTree: [],
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
  pendingNewDirectory: null,
  startCreateDirectory: () => {},
  // @ts-expect-error will get overriden below
  createDirectory: async () => null,
  cancelCreateDirectory: () => {},
  filePathToDelete: null,
  startDeleteDocument: () => {},
  deleteDocument: async () => {},
  confirmDeleteDocument: () => {},
  cancelDeleteDocument: () => {},
  directoryPathToDelete: null,
  startDeleteDirectory: () => {},
  deleteDirectory: async () => {},
  confirmDeleteDirectory: () => {},
  cancelDeleteDirectory: () => {},
  filePathToRename: null,
  startRenameDocument: () => {},
  renameDocumentError: null,
  clearRenameDocumentError: () => {},
  renameDocument: async () => {},
  cancelRenameDocument: () => {},
  directoryPathToRename: null,
  startRenameDirectory: () => {},
  renameDirectoryError: null,
  clearRenameDirectoryError: () => {},
  renameDirectory: async () => {},
  cancelRenameDirectory: () => {},
  getProjectHistory: async () => [],
  getProjectChangedDocuments: async () => [],
  getProjectUncommittedChanges: async () => [],
  commitChanges: async () => {},
  commitDocumentChanges: async () => {},
  // @ts-expect-error will get overriden below
  restoreDocumentChanges: async () => null,
});

const formatSkippedAssetNames = (skippedAssetPaths: string[]): string =>
  skippedAssetPaths.map(removePath).join(', ');

const buildSkippedAssetsOnCommitNotification = (
  skippedAssetPaths: string[]
) => {
  const isSingular = skippedAssetPaths.length === 1;

  return createInfoNotification({
    title: 'Some images were not saved',
    message: `${skippedAssetPaths.length} referenced ${
      isSingular ? 'file is' : 'files are'
    } missing from disk and ${
      isSingular ? 'was' : 'were'
    } left out of this commit: ${formatSkippedAssetNames(skippedAssetPaths)}`.slice(
      0,
      255
    ),
  });
};

const buildSkippedAssetsOnRestoreNotification = (
  skippedAssetPaths: string[]
) => {
  const isSingular = skippedAssetPaths.length === 1;

  return createInfoNotification({
    title: 'Some images were not restored',
    message: `${skippedAssetPaths.length} referenced ${
      isSingular ? 'file' : 'files'
    } could not be read from this version and ${
      isSingular ? 'was' : 'were'
    } left out: ${formatSkippedAssetNames(skippedAssetPaths)}`.slice(0, 255),
  });
};

export const ProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const {
    filesystem,
    projectStoreManager,
    setProjectStore: registerProjectStore,
  } = useContext(InfrastructureAdaptersContext);
  const [loading, setLoading] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<ProjectId | null>(null);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [directoryTree, setDirectoryTree] = useState<ArtifactTreeNode[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [mergeConflictInfo, setMergeConflictInfo] =
    useState<MergeConflictInfo | null>(null);
  const { artifactId: documentIdInPath } = useParams();
  const [projectStore, setProjectStore] = useState<ProjectStore | null>(null);
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<SelectedFileInfo | null>(null);
  const selectedFileName = useMemo(
    () =>
      selectedFileInfo?.path
        ? removeExtension(removePath(selectedFileInfo.path))
        : null,
    [selectedFileInfo?.path]
  );
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
  const [pendingNewDirectory, setPendingNewDirectory] =
    useState<PendingNewDirectory | null>(null);
  const [filePathToDelete, setFileToDelete] = useState<string | null>(null);
  const [directoryPathToDelete, setDirectoryToDelete] = useState<string | null>(
    null
  );
  const [filePathToRename, setDocumentPathToRename] = useState<string | null>(
    null
  );
  const [renameDocumentError, setRenameDocumentError] = useState<string | null>(
    null
  );
  const [directoryPathToRename, setDirectoryPathToRename] = useState<
    string | null
  >(null);
  const [renameDirectoryError, setRenameDirectoryError] = useState<
    string | null
  >(null);

  const getProjectHistory = useCallback(async () => {
    if (!projectStore || !projectId || !currentBranch) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot get project history.'
      );
    }
    return Effect.runPromise(
      projectStore.getProjectCommitHistory({
        projectId,
        branch: currentBranch,
      })
    );
  }, [projectStore, projectId, currentBranch]);

  const getProjectChangedDocuments = useCallback(
    async (changeId: Commit['id']) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot get changed documents.'
        );
      }
      return Effect.runPromise(
        projectStore.getChangedDocumentsAtChange({
          projectId,
          changeId,
        })
      );
    },
    [projectStore, projectId]
  );

  const getProjectUncommittedChanges = useCallback(async () => {
    if (!projectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot get uncommitted changes.'
      );
    }
    return Effect.runPromise(
      projectStore.getChangedDocumentsAtChange({
        projectId,
        changeId: UNCOMMITTED_CHANGE_ID,
      })
    );
  }, [projectStore, projectId]);

  const commitChanges = useCallback(
    async (message: string) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot commit changes.'
        );
      }
      await Effect.runPromise(
        projectStore.commitChanges({ projectId, message })
      );
    },
    [projectStore, projectId]
  );

  const commitDocumentChanges = useCallback(
    async ({
      documentId,
      message,
    }: {
      documentId: ArtifactId;
      message: string;
    }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot commit changes.'
        );
      }
      const { skippedAssetPaths } = await Effect.runPromise(
        projectStore.commitDocumentChanges({
          projectId,
          documentId,
          message,
        })
      );

      if (skippedAssetPaths.length > 0) {
        dispatchNotification(
          buildSkippedAssetsOnCommitNotification(skippedAssetPaths)
        );
      }
    },
    [projectStore, projectId, dispatchNotification]
  );

  const restoreDocumentChanges = useCallback(
    async ({
      documentId,
      commit,
      message,
    }: {
      documentId: ArtifactId;
      commit: Commit;
      message?: string;
    }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot restore document.'
        );
      }
      const { commitId, skippedAssetPaths } = await Effect.runPromise(
        projectStore.restoreDocumentChanges({
          projectId,
          documentId,
          commit,
          message,
        })
      );

      if (skippedAssetPaths.length > 0) {
        dispatchNotification(
          buildSkippedAssetsOnRestoreNotification(skippedAssetPaths)
        );
      }

      return commitId;
    },
    [projectStore, projectId, dispatchNotification]
  );

  const startRenameDocument = useCallback((path: string) => {
    setDocumentPathToRename(path);
    setRenameDocumentError(null);
  }, []);

  const startRenameDirectory = useCallback((path: string) => {
    setDirectoryPathToRename(path);
    setRenameDirectoryError(null);
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const navigateToResolveMergeConflicts = useNavigateToResolveConflicts();

  useEffect(() => {
    const getSelectedDirectory = async () => {
      // Check if we have a project ID in the browser storage
      const browserStorageBrowserDataValue = localStorage.getItem(
        PROJECT_BROWSER_STORAGE_KEY
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
          projectStore: openedProjectStore,
          directory,
          currentBranch,
          mergeConflictInfo,
          remoteProjects,
        } = await Effect.runPromise(
          projectStoreManager.openProjectById({
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
        setMergeConflictInfo(mergeConflictInfo);
        setRemoteProject(remoteProjects.length > 0 ? remoteProjects[0] : null);
        setProjectStore(openedProjectStore);
        registerProjectStore(openedProjectStore);

        setLoading(false);

        if (mergeConflictInfo) {
          navigateToResolveMergeConflicts({
            projectId: browserStorageProjectData.projectId,
            mergeConflictInfo,
          });
        } else {
          // Only redirect to /artifacts if the user isn't already on a
          // project subroute (e.g. /history). This effect runs on mount,
          // so when navigating from /settings back to project routes the
          // current location already reflects the target subroute.
          const projectBase = `/projects/${urlEncodeProjectId(browserStorageProjectData.projectId)}`;
          const isAlreadyOnProjectSubroute = location.pathname.startsWith(
            `${projectBase}/`
          );

          if (!isAlreadyOnProjectSubroute) {
            navigate(`${projectBase}/artifacts`);
          }
        }
      }
    };

    getSelectedDirectory();
  }, []);

  const refreshDirectoryTree = useCallback(async () => {
    if (
      !projectStore ||
      !projectId ||
      !directory ||
      directory.permissionState !== 'granted'
    ) {
      return;
    }

    const tree = await Effect.runPromise(
      projectStore.getProjectTree(projectId)
    );
    setDirectoryTree(tree);
  }, [projectStore, projectId, directory]);

  useEffect(() => {
    refreshDirectoryTree();
  }, [refreshDirectoryTree, currentBranch, pulledUpstreamChanges]);

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

        const newUrl = `/projects/${urlEncodeProjectId(projId)}/artifacts/${urlEncodeArtifactId(doc.id)}`;
        setPulledUpstreamChanges(false);
        navigate(newUrl);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        // TODO: Only do this on NotFoundError.
        // TODO: Navigate to the specific project route (doesn't exist at the time of writing) this.
        navigateToProjectsList();
      }
    };

    if (projectId && selectedFileInfo?.path && !mergeConflictInfo) {
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
  }, [currentBranch, pulledUpstreamChanges, mergeConflictInfo]);

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
      projectStore,
      projectId,
      remoteProject,
    }: {
      projectStore: ProjectStore;
      projectId: ProjectId;
      remoteProject: RemoteProjectInfo;
    }) => {
      const branchInfo = await Effect.runPromise(
        projectStore.getRemoteBranchInfo({
          projectId,
          remoteName: remoteProject.name,
        })
      );

      setRemoteBranchInfo(branchInfo);
    };

    if (projectStore && projectId && remoteProject) {
      fetchRemoteBranchInfo({
        projectStore,
        projectId,
        remoteProject,
      });
    }
  }, [projectStore, projectId, remoteProject]);

  const handleOpenDirectory = useCallback(
    async (cloneUrl?: string) => {
      setLoading(true);

      const {
        projectStore: openedProjectStore,
        projectId: projId,
        directory: dir,
        currentBranch,
        mergeConflictInfo,
        remoteProjects,
      } = await Effect.runPromise(
        projectStoreManager.openOrCreateProject({
          filesystem,
        })({ username, email, cloneUrl })
      );

      setProjectId(projId);
      setDirectory(dir);
      setCurrentBranch(currentBranch);
      setMergeConflictInfo(mergeConflictInfo);
      setRemoteProject(remoteProjects.length > 0 ? remoteProjects[0] : null);
      setProjectStore(openedProjectStore);
      registerProjectStore(openedProjectStore);

      localStorage.setItem(
        PROJECT_BROWSER_STORAGE_KEY,
        JSON.stringify({
          directoryName: dir.name,
          directoryPath: dir.path,
          projectId: projId,
        })
      );

      setLoading(false);

      if (mergeConflictInfo) {
        navigateToResolveMergeConflicts({
          projectId: projId,
          mergeConflictInfo,
        });
      } else {
        navigate(`/projects/${urlEncodeProjectId(projId)}/artifacts`);
      }

      return dir;
    },
    [projectStoreManager, username, email]
  );

  const handleCreateNewDocument = useCallback(
    async (args?: CreateNewDocumentArgs) => {
      if (!projectStore || !projectId || !directory) {
        throw new Error(
          'Cannot create document. Document and project store have not been initialized yet.'
        );
      }

      const parentDirectoryId = args?.parentPath
        ? (findNodeByPath({
            tree: directoryTree,
            path: parseProjectRelPath(args.parentPath),
          })?.id ?? undefined)
        : undefined;

      const result = await Effect.runPromise(
        pipe(
          createDocumentInProject({
            createNewFile: filesystem.createNewFile,
            getRelativePath: filesystem.getRelativePath,
            getAbsolutePath: filesystem.getAbsolutePath,
            getArtifactPathById: projectStore.getArtifactPathById,
            createDocument: projectStore.createDocument,
          })({
            projectId,
            projectDirectory: directory,
            parentDirectoryId,
            content: null,
          }),
          Effect.map(Option.getOrNull)
        )
      );

      // Save dialog was cancelled.
      if (!result) {
        return null;
      }

      await refreshDirectoryTree();

      return {
        projectId,
        documentId: result.documentId,
        path: result.filePath,
      };
    },
    [
      projectStore,
      projectId,
      directory,
      filesystem,
      directoryTree,
      refreshDirectoryTree,
    ]
  );

  const handleCreateDirectory = useCallback(
    async (name: string) => {
      if (!projectStore || !projectId || !pendingNewDirectory) return;

      const parentDirectoryId = pendingNewDirectory.parentPath
        ? (findNodeByPath({
            tree: directoryTree,
            path: parseProjectRelPath(pendingNewDirectory.parentPath),
          })?.id ?? undefined)
        : undefined;

      await Effect.runPromise(
        projectStore.createDirectory({ projectId, parentDirectoryId, name })
      );

      await refreshDirectoryTree();
      setPendingNewDirectory(null);
    },
    [
      projectStore,
      projectId,
      directoryTree,
      pendingNewDirectory,
      refreshDirectoryTree,
    ]
  );

  const startCreateDirectory = useCallback(
    (parentPath?: string) => setPendingNewDirectory({ parentPath }),
    []
  );

  const cancelCreateDirectory = useCallback(() => {
    setPendingNewDirectory(null);
  }, []);

  const handleDeleteDocument = useCallback(
    async ({ relativePath }: { relativePath: string }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Cannot delete file. Document and project store have not been initialized yet.'
        );
      }

      const documentId = findNodeByPath({
        tree: directoryTree,
        path: parseProjectRelPath(relativePath),
      })?.id;
      if (!documentId) {
        setFileToDelete(null);
        return;
      }

      try {
        await Effect.runPromise(
          projectStore.deleteDocument({
            documentId,
            projectId,
            deleteFromFilesystem: true,
          })
        );

        await refreshDirectoryTree();

        // If the deleted file was currently selected, clear selection and navigate away
        if (selectedFileInfo?.path === relativePath) {
          await clearFileSelection();
          navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
        }

        setFileToDelete(null);
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Delete File Error',
            message:
              'An error happened when trying to delete the file. Please try again.',
          })
        );
        setFileToDelete(null);
      }
    },
    [
      projectStore,
      projectId,
      directoryTree,
      selectedFileInfo,
      navigate,
      refreshDirectoryTree,
      dispatchNotification,
    ]
  );

  const handleDeleteDirectory = useCallback(
    async ({ relativePath }: { relativePath: string }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Cannot delete folder. Document and project store have not been initialized yet.'
        );
      }

      const directoryId = findNodeByPath({
        tree: directoryTree,
        path: parseProjectRelPath(relativePath),
      })?.id;
      if (!directoryId) {
        setDirectoryToDelete(null);
        return;
      }

      try {
        await Effect.runPromise(
          projectStore.deleteDirectory({ projectId, directoryId })
        );

        await refreshDirectoryTree();

        // If the currently selected file was inside the deleted directory,
        // clear selection and navigate away.
        if (
          selectedFileInfo?.path &&
          isPathInsideDirectory({
            directoryPath: parseProjectRelPath(relativePath),
            filePath: parseProjectRelPath(selectedFileInfo.path),
          })
        ) {
          setSelectedFileInfo(null);
          navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
        }

        setDirectoryToDelete(null);
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Delete Folder Error',
            message:
              'An error happened when trying to delete the folder. Please try again.',
          })
        );
        setDirectoryToDelete(null);
      }
    },
    [
      projectStore,
      projectId,
      directoryTree,
      selectedFileInfo,
      navigate,
      refreshDirectoryTree,
      dispatchNotification,
    ]
  );

  const handleConfirmDeleteDocument = useCallback(() => {
    if (filePathToDelete) {
      handleDeleteDocument({ relativePath: filePathToDelete });
    }
  }, [filePathToDelete, handleDeleteDocument]);

  const handleCancelDeleteDocument = useCallback(
    () => setFileToDelete(null),
    []
  );

  const handleConfirmDeleteDirectory = useCallback(() => {
    if (directoryPathToDelete) {
      handleDeleteDirectory({ relativePath: directoryPathToDelete });
    }
  }, [directoryPathToDelete, handleDeleteDirectory]);

  const handleCancelDeleteDirectory = useCallback(
    () => setDirectoryToDelete(null),
    []
  );

  const handleRenameDocument = useCallback(
    async ({
      oldRelativePath,
      newName,
    }: {
      oldRelativePath: string;
      newName: string;
    }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Cannot rename document. The project store has not been initialized yet.'
        );
      }

      if (!newName.trim()) {
        return;
      }

      try {
        const result = await Effect.runPromise(
          pipe(
            renameDocumentInProject({
              renameDocumentInProjectStore:
                projectStore.renameDocumentInProject,
              getRenamedPath: filesystem.getRenamedPath,
            })({
              projectId,
              oldDocumentPath: oldRelativePath,
              newName,
            }),
            Effect.map(({ newDocumentPath }) => ({
              collision: false as const,
              newDocumentPath,
            })),
            Effect.catchTag(FilesystemAlreadyExistsErrorTag, () =>
              Effect.succeed({
                collision: true as const,
                newDocumentPath: null,
              })
            )
          )
        );

        if (result.collision) {
          setRenameDocumentError('A document with this name already exists');
          return;
        }

        await refreshDirectoryTree();

        // If the renamed file was currently selected, follow it to its new id.
        if (selectedFileInfo?.path === oldRelativePath && currentBranch) {
          const newDocumentId = await Effect.runPromise(
            projectStore.lookupArtifactByPath({
              projectId,
              path: result.newDocumentPath,
              ref: currentBranch,
            })
          );
          handleSetSelectedFileInfo({
            documentId: newDocumentId,
            path: result.newDocumentPath,
          });
          navigate(
            `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(newDocumentId)}`
          );
        }

        setDocumentPathToRename(null);
        setRenameDocumentError(null);
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Rename Document Error',
            message:
              'An error happened when trying to rename the document. Please try again.',
          })
        );
        setDocumentPathToRename(null);
        setRenameDocumentError(null);
      }
    },
    [
      projectStore,
      projectId,
      filesystem,
      currentBranch,
      selectedFileInfo,
      navigate,
      refreshDirectoryTree,
      dispatchNotification,
    ]
  );

  const clearRenameDocumentError = useCallback(() => {
    setRenameDocumentError(null);
  }, []);

  const cancelRenameDocument = useCallback(() => {
    setDocumentPathToRename(null);
    setRenameDocumentError(null);
  }, []);

  const handleRenameDirectory = useCallback(
    async ({
      oldRelativePath,
      newName,
    }: {
      oldRelativePath: string;
      newName: string;
    }) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Cannot rename directory. The project store has not been initialized yet.'
        );
      }

      if (!newName.trim()) {
        return;
      }

      try {
        const result = await Effect.runPromise(
          pipe(
            projectStore.renameDirectory({
              projectId,
              oldDirectoryPath: oldRelativePath,
              newDirectoryName: newName,
            }),
            Effect.map(({ newDirectoryPath }) => ({
              collision: false as const,
              newDirectoryPath,
            })),
            Effect.catchTag(FilesystemAlreadyExistsErrorTag, () =>
              Effect.succeed({
                collision: true as const,
                newDirectoryPath: null,
              })
            )
          )
        );

        if (result.collision) {
          setRenameDirectoryError('A folder with this name already exists');
          return;
        }

        await refreshDirectoryTree();

        // If the currently-selected file was inside the renamed directory,
        // move the selection to its new path under the renamed directory.
        if (
          selectedFileInfo?.path &&
          isPathInsideDirectory({
            directoryPath: parseProjectRelPath(oldRelativePath),
            filePath: parseProjectRelPath(selectedFileInfo.path),
          })
        ) {
          const newFilePath =
            result.newDirectoryPath +
            selectedFileInfo.path.slice(oldRelativePath.length);
          try {
            const doc = await handleFindDocumentInProject({
              projectId,
              documentPath: newFilePath,
            });
            handleSetSelectedFileInfo({
              documentId: doc.id,
              path: newFilePath,
            });
            navigate(
              `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(doc.id)}`
            );
          } catch {
            await clearFileSelection();
            navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
          }
        }

        setDirectoryPathToRename(null);
        setRenameDirectoryError(null);
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Rename Folder Error',
            message:
              'An error happened when trying to rename the folder. Please try again.',
          })
        );
        setDirectoryPathToRename(null);
        setRenameDirectoryError(null);
      }
    },
    [
      projectStore,
      projectId,
      selectedFileInfo,
      navigate,
      refreshDirectoryTree,
      dispatchNotification,
    ]
  );

  const clearRenameDirectoryError = useCallback(() => {
    setRenameDirectoryError(null);
  }, []);

  const cancelRenameDirectory = useCallback(() => {
    setDirectoryPathToRename(null);
    setRenameDirectoryError(null);
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onContextMenuAction(
      async (action) => {
        if (
          action.context === EXPLORER_TREE_DIRECTORY &&
          action.action.type === 'NEW_FILE'
        ) {
          const result = await handleCreateNewDocument({
            parentPath: action.action.parentPath,
          });

          if (!result) return;

          const { documentId, projectId: projId, path: filePath } = result;

          handleSetSelectedFileInfo({ documentId, path: filePath });
          navigate(
            `/projects/${urlEncodeProjectId(projId)}/artifacts/${urlEncodeArtifactId(documentId)}`
          );
        }

        if (
          action.context === EXPLORER_TREE_DIRECTORY &&
          action.action.type === 'NEW_DIRECTORY'
        ) {
          setPendingNewDirectory({ parentPath: action.action.parentPath });
        }

        if (
          action.context === EXPLORER_TREE_FILE &&
          action.action.type === 'DELETE'
        ) {
          setFileToDelete(action.action.path);
        }

        if (
          action.context === EXPLORER_TREE_DIRECTORY &&
          action.action.type === 'DELETE'
        ) {
          setDirectoryToDelete(action.action.path);
        }

        if (
          action.context === EXPLORER_TREE_FILE &&
          action.action.type === 'RENAME'
        ) {
          setDocumentPathToRename(action.action.path);
          setRenameDocumentError(null);
        }

        if (
          action.context === EXPLORER_TREE_DIRECTORY &&
          action.action.type === 'RENAME'
        ) {
          setDirectoryPathToRename(action.action.path);
          setRenameDirectoryError(null);
        }
      }
    );

    return unsubscribe;
  }, [handleCreateNewDocument, navigate]);

  useEffect(() => {
    if (projectStore) {
      setSupportsBranching(projectStore.supportsBranching);
    }
  }, [projectStore]);

  const handleFindDocumentInProject = async (args: {
    projectId: ProjectId;
    documentPath: string;
    changeId?: ChangeId;
  }) => {
    if (!projectStore) {
      throw new Error(
        'Cannot create document. Document and project store have not been initialized yet.'
      );
    }

    return Effect.runPromise(
      projectStore.findDocumentByPath({
        projectId: args.projectId,
        documentPath: args.documentPath,
        changeId: args.changeId,
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
    window.electronAPI.sendCurrentDocumentId(documentId);

    setSelectedFileInfo({
      documentId,
      path: path,
    });
  };

  const handleListBranches = useCallback(async () => {
    if (!projectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot list branches'
      );
    }

    const branches = await Effect.runPromise(
      projectStore.listBranches({ projectId })
    );

    return branches;
  }, [projectStore, projectId]);

  const handleCreateAndSwitchToBranch = useCallback(
    async (branchName: string) => {
      if (!projectStore || !projectId) {
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
        projectStore.createAndSwitchToBranch({ projectId, branch })
      );

      setCurrentBranch(branch);
      setIsCreateBranchDialogOpen(false);
    },
    [projectStore, projectId]
  );

  const handleSwitchToBranch = useCallback(
    async (branch: Branch) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot create branch.'
        );
      }

      await Effect.runPromise(
        projectStore.switchToBranch({ projectId, branch })
      );

      setCurrentBranch(branch);
    },
    [projectStore, projectId]
  );

  const handleOpenCreateBranchDialog = useCallback(() => {
    setIsCreateBranchDialogOpen(true);
  }, []);

  const handleCloseCreateBranchDialog = useCallback(() => {
    setIsCreateBranchDialogOpen(false);
  }, []);

  const handleDeleteBranch = useCallback(
    async (branch: Branch) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot delete branch.'
        );
      }

      const { currentBranch: resultingCurrentBranch } = await Effect.runPromise(
        projectStore.deleteBranch({ projectId, branch })
      );

      setBranchToDelete(null);
      setCurrentBranch(resultingCurrentBranch);
    },
    [projectStore, projectId]
  );

  const handleMergeAndDeleteBranch = useCallback(
    async (branch: Branch) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot delete branch.'
        );
      }

      const { notification, mergeConflictInfo: conflictInfo } =
        await Effect.runPromise(
          pipe(
            pipe(
              projectStore.mergeAndDeleteBranch({
                projectId,
                from: branch,
                into: DEFAULT_BRANCH as Branch,
              }),
              Effect.map((lastCommitId) => ({
                result: lastCommitId,
                notification: null,
                mergeConflictInfo: null,
              }))
            ),
            Effect.catchTag(VersionControlMergeConflictErrorTag, (err) =>
              Effect.succeed({
                result: null,
                notification: null,
                mergeConflictInfo: err.data,
              })
            ),
            Effect.catchAll((err) => {
              console.error(err);
              const notification = createErrorNotification({
                title: 'Merge Error',
                message: `An error happened when trying to merge "${branch}" into "${DEFAULT_BRANCH}" branch`,
              });

              return Effect.succeed({
                result: null,
                notification,
                mergeConflictInfo: null,
              });
            })
          )
        );

      if (notification) {
        dispatchNotification(notification);
      }

      setCurrentBranch(DEFAULT_BRANCH as Branch);

      if (conflictInfo) {
        setMergeConflictInfo(conflictInfo);
        navigateToResolveMergeConflicts({
          projectId,
          mergeConflictInfo: conflictInfo,
        });
      }
    },
    [projectStore, projectId, navigateToResolveMergeConflicts]
  );

  const handleAbortMerge = useCallback(async () => {
    if (!projectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot abort merge.'
      );
    }

    const { notification } = await Effect.runPromise(
      pipe(
        pipe(
          projectStore.abortMerge({
            projectId,
          }),
          Effect.map(() => ({
            notification: null,
          }))
        ),
        Effect.catchAll((err) => {
          console.error(err);
          const notification = createErrorNotification({
            title: 'Abort Merge Error',
            message:
              'An error happened when trying to abort the merge operation. Please contact us for support.',
          });

          return Effect.succeed({
            notification,
          });
        })
      )
    );

    if (notification) {
      dispatchNotification(notification);
    } else {
      navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
    }
  }, [projectStore, projectId]);

  const handleRefreshConflictsAndMergeIfPossible = useCallback(async () => {
    if (!projectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot get merge conflict info.'
      );
    }

    const { notification, conflictInfo } = await Effect.runPromise(
      pipe(
        pipe(
          projectStore.getMergeConflictInfo({
            projectId,
          }),
          Effect.tap((conflictInfo) => {
            const conflicts = conflictInfo?.conflicts;

            return conflicts && conflicts.length > 0
              ? Effect.succeed(undefined)
              : projectStore.commitMergeConflictsResolution({
                  projectId,
                });
          }),
          Effect.map((conflictInfo) => ({
            conflictInfo,
            notification: null,
          }))
        ),
        Effect.catchAll((err) => {
          console.error(err);
          const notification = createErrorNotification({
            title: 'Get Merge Conflict Info Error',
            message:
              'An error happened when trying to get the merge conflict info. Please refresh and, if the problem is not resolved, contact us for support.',
          });

          return Effect.succeed({
            conflictInfo: null,
            notification,
          });
        })
      )
    );

    if (notification) {
      dispatchNotification(notification);
    } else {
      if (conflictInfo && conflictInfo.conflicts.length > 0) {
        setMergeConflictInfo(conflictInfo);
        navigateToResolveMergeConflicts({
          projectId,
          mergeConflictInfo: conflictInfo,
        });
      } else {
        const notification = createSuccessNotification({
          title: 'Successful Merge',
          message:
            'The branch was merged successfully. You are back in the main branch.',
        });
        dispatchNotification(notification);
        setMergeConflictInfo(null);
        navigate(`/projects/${urlEncodeProjectId(projectId)}/artifacts`);
      }
    }
  }, [projectStore, projectId, navigateToResolveMergeConflicts]);

  const handleResolveConflictByKeepingDocument = useCallback(
    async (documentId: ArtifactId) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot resolve the conflict.'
        );
      }

      try {
        await Effect.runPromise(
          projectStore.resolveConflictByKeepingDocument({
            projectId,
            documentId,
          })
        );
      } catch (err) {
        console.error(err);

        const notification = createErrorNotification({
          title: 'Resolve Conflict Error',
          message: `An error happened when trying to resolve the conflict. Please try again and if the error persists contact us for support.`,
        });
        dispatchNotification(notification);
      }

      handleRefreshConflictsAndMergeIfPossible();
    },
    [projectStore, projectId, handleRefreshConflictsAndMergeIfPossible]
  );

  const handleResolveConflictByDeletingDocument = useCallback(
    async (documentId: ArtifactId) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot resolve the conflict.'
        );
      }

      try {
        await Effect.runPromise(
          projectStore.resolveConflictByDeletingDocument({
            projectId,
            documentId,
          })
        );
      } catch (err) {
        console.error(err);

        const notification = createErrorNotification({
          title: 'Resolve Conflict Error',
          message: `An error happened when trying to resolve the conflict. Please try again and if the error persists contact us for support.`,
        });
        dispatchNotification(notification);
      }

      handleRefreshConflictsAndMergeIfPossible();
    },
    [projectStore, projectId, handleRefreshConflictsAndMergeIfPossible]
  );

  const handleOpenDeleteBranchDialog = useCallback((branch: Branch) => {
    setBranchToDelete(branch);
  }, []);

  const handleCloseDeleteBranchDialog = useCallback(() => {
    setBranchToDelete(null);
  }, []);

  useEffect(() => {
    const updateAuthorInfoInProjectStore = async ({
      projectStore,
      projectId,
    }: {
      projectStore: ProjectStore;
      projectId: ProjectId;
    }) => {
      projectStore.setAuthorInfo({
        projectId,
        username,
        email,
      });
    };

    if (projectStore && projectId) {
      updateAuthorInfoInProjectStore({
        projectStore,
        projectId,
      });
    }
  }, [username, email, projectStore, projectId]);

  const handleAddRemoteProject = useCallback(
    async (url: string) => {
      if (!projectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot add remote project.'
        );
      }

      const { notification, result } = await Effect.runPromise(
        pipe(
          pipe(
            projectStore.addRemoteProject({
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
    [projectStore, projectId]
  );

  const handlePushToRemoteProject = useCallback(async () => {
    if (!projectStore || !projectId || !remoteProject) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot push to remote project.'
      );
    }

    try {
      await Effect.runPromise(
        projectStore.pushToRemoteProject({
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
  }, [projectStore, projectId, remoteProject]);

  const handlePullFromRemoteProject = useCallback(async () => {
    if (!projectStore || !projectId || !remoteProject) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot pull from remote project.'
      );
    }

    try {
      await Effect.runPromise(
        projectStore.pullFromRemoteProject({
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
  }, [projectStore, projectId, remoteProject]);

  const resetPulledUpstreamChanges = () => {
    setPulledUpstreamChanges(false);
  };

  return (
    <ProjectContext.Provider
      value={{
        loading,
        projectId,
        directory,
        directoryTree,
        refreshDirectoryTree,
        currentBranch,
        projectStore,
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
        abortMerge: handleAbortMerge,
        refreshConflictsAndMergeIfPossible:
          handleRefreshConflictsAndMergeIfPossible,
        resolveConflictByKeepingDocument:
          handleResolveConflictByKeepingDocument,
        resolveConflictByDeletingDocument:
          handleResolveConflictByDeletingDocument,
        branchToDelete,
        openDeleteBranchDialog: handleOpenDeleteBranchDialog,
        closeDeleteBranchDialog: handleCloseDeleteBranchDialog,
        supportsBranching,
        supportsSync: Boolean(remoteProject),
        mergeConflictInfo,
        remoteProject,
        addRemoteProject: handleAddRemoteProject,
        remoteBranchInfo,
        pushToRemoteProject: handlePushToRemoteProject,
        pullFromRemoteProject: handlePullFromRemoteProject,
        pulledUpstreamChanges,
        onHandlePulledUpstreamChanges: resetPulledUpstreamChanges,
        pendingNewDirectory,
        startCreateDirectory,
        createDirectory: handleCreateDirectory,
        cancelCreateDirectory,
        filePathToDelete,
        startDeleteDocument: setFileToDelete,
        deleteDocument: handleDeleteDocument,
        confirmDeleteDocument: handleConfirmDeleteDocument,
        cancelDeleteDocument: handleCancelDeleteDocument,
        directoryPathToDelete,
        startDeleteDirectory: setDirectoryToDelete,
        deleteDirectory: handleDeleteDirectory,
        confirmDeleteDirectory: handleConfirmDeleteDirectory,
        cancelDeleteDirectory: handleCancelDeleteDirectory,
        filePathToRename,
        startRenameDocument,
        renameDocumentError,
        clearRenameDocumentError,
        renameDocument: handleRenameDocument,
        cancelRenameDocument,
        directoryPathToRename,
        startRenameDirectory,
        renameDirectoryError,
        clearRenameDirectoryError,
        renameDirectory: handleRenameDirectory,
        cancelRenameDirectory,
        getProjectHistory,
        getProjectChangedDocuments,
        getProjectUncommittedChanges,
        commitChanges,
        commitDocumentChanges,
        restoreDocumentChanges,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
