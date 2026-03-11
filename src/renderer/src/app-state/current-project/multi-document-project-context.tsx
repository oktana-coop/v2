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
  deleteDocumentFromProject,
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
import {
  EXPLORER_TREE_DIRECTORY,
  EXPLORER_TREE_FILE,
} from '../../../../modules/infrastructure/cross-platform';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import {
  type Directory,
  type File,
  filesystemItemTypes,
  getDirectoryName,
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
  type MergeConflictInfo,
  parseBranch,
  type ResolvedArtifactId,
  urlEncodeArtifactId,
  VersionControlMergeConflictErrorTag,
} from '../../../../modules/infrastructure/version-control';
import { useNavigateToResolveConflicts } from '../../hooks';
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
  parentPath?: string;
};

type PendingNewDirectory = {
  parentPath: string;
};

export type MultiDocumentProjectContextType = {
  loading: boolean;
  projectId: ProjectId | null;
  directory: Directory | null;
  currentBranch: Branch | null;
  directoryTree: Array<Directory | File>;
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
  abortMerge: () => Promise<void>;
  refreshConflictsAndMergeIfPossible: () => Promise<void>;
  resolveConflictByKeepingDocument: (
    documentId: ResolvedArtifactId
  ) => Promise<void>;
  resolveConflictByDeletingDocument: (
    documentId: ResolvedArtifactId
  ) => Promise<void>;
  branchToDelete: Branch | null;
  openDeleteBranchDialog: (branch: Branch) => void;
  closeDeleteBranchDialog: () => void;
  supportsBranching: boolean;
  mergeConflictInfo: MergeConflictInfo | null;
  remoteProject: RemoteProjectInfo | null;
  addRemoteProject: (url: string) => Promise<void>;
  remoteBranchInfo: Record<Branch, Commit['id']>;
  pushToRemoteProject: () => Promise<void>;
  pullFromRemoteProject: () => Promise<void>;
  pulledUpstreamChanges: boolean;
  onHandlePulledUpstreamChanges: () => void;
  pendingNewDirectory: PendingNewDirectory | null;
  createDirectory: (name: string) => Promise<void>;
  cancelCreateDirectory: () => void;
  filePathToDelete: string | null;
  deleteDocument: (args: { relativePath: string }) => Promise<void>;
  cancelDeleteDocument: () => void;
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
    pendingNewDirectory: null,
    // @ts-expect-error will get overriden below
    createDirectory: async () => null,
    cancelCreateDirectory: () => {},
    filePathToDelete: null,
    deleteDocument: async () => {},
    cancelDeleteDocument: () => {},
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
  const [directoryTree, setDirectoryTree] = useState<Array<Directory | File>>(
    []
  );
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [mergeConflictInfo, setMergeConflictInfo] =
    useState<MergeConflictInfo | null>(null);
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
  const [pendingNewDirectory, setPendingNewDirectory] =
    useState<PendingNewDirectory | null>(null);
  const [filePathToDelete, setFileToDelete] = useState<string | null>(null);
  const navigate = useNavigate();
  const navigateToResolveMergeConflicts = useNavigateToResolveConflicts();

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
          mergeConflictInfo,
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
        setMergeConflictInfo(mergeConflictInfo);
        setRemoteProject(remoteProjects.length > 0 ? remoteProjects[0] : null);
        setVersionedProjectStore(projectStore);
        setVersionedDocumentStore(documentStore);

        setLoading(false);

        if (mergeConflictInfo) {
          navigateToResolveMergeConflicts({
            projectId: browserStorageProjectData.projectId,
            mergeConflictInfo,
          });
        } else {
          navigate(
            `/projects/${urlEncodeProjectId(browserStorageProjectData.projectId)}/documents`
          );
        }
      }
    };

    getSelectedDirectory();
  }, []);

  useEffect(() => {
    const getDirTree = async (dir: Directory) => {
      const dirTree = await Effect.runPromise(
        filesystem.listDirectoryTree({
          path: dir.path,
          extensions: [
            richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
          ],
          useRelativePathTo: dir.path,
        })
      );
      setDirectoryTree(dirTree);
    };

    if (directory && directory.permissionState === 'granted') {
      getDirTree(directory);
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
        mergeConflictInfo,
        remoteProjects,
      } = await Effect.runPromise(
        multiDocumentProjectStoreManager.openOrCreateMultiDocumentProject({
          filesystem,
        })({ username, email, cloneUrl })
      );

      setProjectId(projId);
      setDirectory(dir);
      setCurrentBranch(currentBranch);
      setMergeConflictInfo(mergeConflictInfo);
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

      if (mergeConflictInfo) {
        navigateToResolveMergeConflicts({
          projectId: projId,
          mergeConflictInfo,
        });
      } else {
        navigate(`/projects/${urlEncodeProjectId(projId)}/documents`);
      }

      return dir;
    },
    [multiDocumentProjectStoreManager, username, email]
  );

  const handleCreateNewDocument = useCallback(
    async (args?: CreateNewDocumentArgs) => {
      if (!versionedDocumentStore || !versionedProjectStore || !projectId) {
        throw new Error(
          'Cannot create document. Document and project store have not been initialized yet.'
        );
      }

      const { documentId: newDocumentId, filePath: newFilePath } =
        await Effect.runPromise(
          pipe(
            args?.parentPath && directory
              ? pipe(
                  filesystem.getAbsolutePath({
                    path: args.parentPath,
                    dirPath: directory.path,
                  }),
                  Effect.map(
                    (parentAbsolutePath) =>
                      ({
                        type: filesystemItemTypes.DIRECTORY,
                        path: parentAbsolutePath,
                        name: getDirectoryName(parentAbsolutePath),
                        permissionState: 'granted',
                      }) as Directory | null
                  )
                )
              : Effect.succeed(null),
            Effect.flatMap((parentDirectory) =>
              createVersionedDocument({
                createNewFile: filesystem.createNewFile,
                getRelativePath: filesystem.getRelativePath,
                createDocument: versionedDocumentStore.createDocument,
                addDocumentToProject:
                  versionedProjectStore.addDocumentToProject,
              })({
                projectId,
                content: null,
                projectDirectory: directory,
                parentDirectory,
              })
            )
          )
        );

      // Refresh directory files if a directory is selected
      if (
        directory &&
        directory.permissionState === 'granted' &&
        directory.path
      ) {
        const dirTree = await Effect.runPromise(
          filesystem.listDirectoryTree({
            path: directory.path,
            extensions: [
              richTextRepresentationExtensions[
                PRIMARY_RICH_TEXT_REPRESENTATION
              ],
            ],
            useRelativePathTo: directory.path,
          })
        );
        setDirectoryTree(dirTree);
      }

      return { projectId, documentId: newDocumentId, path: newFilePath };
    },
    [versionedDocumentStore, versionedProjectStore]
  );

  const handleCreateDirectory = useCallback(
    async (name: string) => {
      if (!directory || !pendingNewDirectory) return;

      await Effect.runPromise(
        pipe(
          filesystem.getAbsolutePath({
            path: pendingNewDirectory.parentPath,
            dirPath: directory.path,
          }),
          Effect.flatMap((parentAbsolutePath) =>
            filesystem.createDirectory({
              name,
              parentDirectory: {
                type: filesystemItemTypes.DIRECTORY,
                path: parentAbsolutePath,
                name,
                permissionState: 'granted' as PermissionState,
              },
            })
          )
        )
      );

      setPendingNewDirectory(null);

      if (
        directory &&
        directory.permissionState === 'granted' &&
        directory.path
      ) {
        const dirTree = await Effect.runPromise(
          filesystem.listDirectoryTree({
            path: directory.path,
            extensions: [
              richTextRepresentationExtensions[
                PRIMARY_RICH_TEXT_REPRESENTATION
              ],
            ],
            useRelativePathTo: directory.path,
          })
        );
        setDirectoryTree(dirTree);
      }
    },
    [filesystem, directory, pendingNewDirectory]
  );

  const cancelCreateDirectory = useCallback(() => {
    setPendingNewDirectory(null);
  }, []);

  const handleDeleteDocument = useCallback(
    async ({ relativePath }: { relativePath: string }) => {
      if (!directory) {
        return;
      }

      if (!versionedDocumentStore || !versionedProjectStore || !projectId) {
        throw new Error(
          'Cannot delete file. Document and project store have not been initialized yet.'
        );
      }

      try {
        await Effect.runPromise(
          pipe(
            findDocumentInProject({
              findDocumentById: versionedDocumentStore.findDocumentById,
              findDocumentInProjectStore:
                versionedProjectStore.findDocumentInProject,
            })({
              projectId,
              documentPath: relativePath,
            }),
            Effect.flatMap((doc) =>
              deleteDocumentFromProject({
                deleteDocument: versionedDocumentStore.deleteDocument,
                deleteDocumentFromProjectStore:
                  versionedProjectStore.deleteDocumentFromProject,
              })({
                documentId: doc.id,
                projectId,
                deleteFromFilesystem: true,
              })
            )
          )
        );

        // Refresh directory tree
        if (directory.permissionState === 'granted' && directory.path) {
          const dirTree = await Effect.runPromise(
            filesystem.listDirectoryTree({
              path: directory.path,
              extensions: [
                richTextRepresentationExtensions[
                  PRIMARY_RICH_TEXT_REPRESENTATION
                ],
              ],
              useRelativePathTo: directory.path,
            })
          );
          setDirectoryTree(dirTree);
        }

        // If the deleted file was currently selected, clear selection and navigate away
        if (selectedFileInfo?.path === relativePath) {
          await clearFileSelection();
          navigate(`/projects/${urlEncodeProjectId(projectId)}/documents`);
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
      versionedDocumentStore,
      versionedProjectStore,
      projectId,
      directory,
      filesystem,
      selectedFileInfo,
      navigate,
      dispatchNotification,
    ]
  );

  useEffect(() => {
    if (!isElectron) return;

    const unsubscribe = window.electronAPI.onContextMenuAction(
      async (action) => {
        if (
          action.context === EXPLORER_TREE_DIRECTORY &&
          action.action.type === 'NEW_FILE'
        ) {
          const {
            documentId,
            projectId: projId,
            path: filePath,
          } = await handleCreateNewDocument({
            parentPath: action.action.parentPath,
          });

          handleSetSelectedFileInfo({ documentId, path: filePath });
          navigate(
            `/projects/${urlEncodeProjectId(projId)}/documents/${urlEncodeArtifactId(documentId)}?path=${encodeURIComponent(filePath)}`
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
      }
    );

    return unsubscribe;
  }, [isElectron, handleCreateNewDocument, navigate]);

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

      const { notification, mergeConflictInfo: conflictInfo } =
        await Effect.runPromise(
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
    [versionedProjectStore, projectId, navigateToResolveMergeConflicts]
  );

  const handleAbortMerge = useCallback(async () => {
    if (!versionedProjectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot abort merge.'
      );
    }

    const { notification } = await Effect.runPromise(
      pipe(
        pipe(
          versionedProjectStore.abortMerge({
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
      navigate(`/projects/${urlEncodeProjectId(projectId)}/documents`);
    }
  }, [versionedProjectStore, projectId]);

  const handleRefreshConflictsAndMergeIfPossible = useCallback(async () => {
    if (!versionedProjectStore || !projectId) {
      throw new Error(
        'Project store is not ready or project has not been set yet. Cannot get merge conflict info.'
      );
    }

    const { notification, conflictInfo } = await Effect.runPromise(
      pipe(
        pipe(
          versionedProjectStore.getMergeConflictInfo({
            projectId,
          }),
          Effect.tap((conflictInfo) => {
            const conflicts = conflictInfo?.conflicts;

            return conflicts && conflicts.length > 0
              ? Effect.succeed(undefined)
              : versionedProjectStore.commitMergeConflictsResolution({
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
        navigate(`/projects/${urlEncodeProjectId(projectId)}/documents`);
      }
    }
  }, [versionedProjectStore, projectId, navigateToResolveMergeConflicts]);

  const handleResolveConflictByKeepingDocument = useCallback(
    async (documentId: ResolvedArtifactId) => {
      if (!versionedProjectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot resolve the conflict.'
        );
      }

      try {
        await Effect.runPromise(
          versionedProjectStore.resolveConflictByKeepingDocument({
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
    [versionedProjectStore, projectId, handleRefreshConflictsAndMergeIfPossible]
  );

  const handleResolveConflictByDeletingDocument = useCallback(
    async (documentId: ResolvedArtifactId) => {
      if (!versionedProjectStore || !projectId) {
        throw new Error(
          'Project store is not ready or project has not been set yet. Cannot resolve the conflict.'
        );
      }

      try {
        await Effect.runPromise(
          versionedProjectStore.resolveConflictByDeletingDocument({
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
    [versionedProjectStore, projectId, handleRefreshConflictsAndMergeIfPossible]
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
        directoryTree,
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
        mergeConflictInfo,
        remoteProject,
        addRemoteProject: handleAddRemoteProject,
        remoteBranchInfo,
        pushToRemoteProject: handlePushToRemoteProject,
        pullFromRemoteProject: handlePullFromRemoteProject,
        pulledUpstreamChanges,
        onHandlePulledUpstreamChanges: resetPulledUpstreamChanges,
        pendingNewDirectory,
        createDirectory: handleCreateDirectory,
        cancelCreateDirectory,
        filePathToDelete,
        deleteDocument: handleDeleteDocument,
        cancelDeleteDocument: () => setFileToDelete(null),
      }}
    >
      {children}
    </MultiDocumentProjectContext.Provider>
  );
};
