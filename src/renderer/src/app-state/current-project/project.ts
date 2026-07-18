import * as Effect from 'effect/Effect';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { AuthContext } from '../../../../modules/auth/browser';
import {
  type OpenOrCreateProjectResult,
  type OpenProjectByIdResult,
  type ProjectId,
  type ProjectStore,
  type RemoteProjectInfo,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import { type Directory } from '../../../../modules/infrastructure/filesystem';
import {
  type Branch,
  type MergeConflictInfo,
} from '../../../../modules/infrastructure/version-control';
import { useNavigateToResolveConflicts } from '../../hooks';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';
import { readStoredProject, storeProject } from './browser-storage';
import { type ProjectContextType, type ProjectStateSetters } from './types';

type ProjectOps = Pick<
  ProjectContextType,
  | 'loading'
  | 'projectId'
  | 'directory'
  | 'currentBranch'
  | 'projectStore'
  | 'openDirectory'
  | 'requestPermissionForSelectedDirectory'
  | 'mergeConflictInfo'
  | 'remoteProject'
  | 'pulledUpstreamChanges'
  | 'onHandlePulledUpstreamChanges'
>;

// The setters are kept here — where this module's own effects read the state —
// so the dependencies between concerns stay one-directional.
export const useProjectOps = (): ProjectOps & ProjectStateSetters => {
  const {
    filesystem,
    projectStoreManager,
    setProjectStore: registerProjectStore,
  } = useContext(InfrastructureAdaptersContext);
  const { username, email } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const navigateToResolveMergeConflicts = useNavigateToResolveConflicts();

  const [loading, setLoading] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<ProjectId | null>(null);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [mergeConflictInfo, setMergeConflictInfo] =
    useState<MergeConflictInfo | null>(null);
  const [projectStore, setProjectStore] = useState<ProjectStore | null>(null);
  const [remoteProject, setRemoteProject] = useState<RemoteProjectInfo | null>(
    null
  );
  const [pulledUpstreamChanges, setPulledUpstreamChanges] =
    useState<boolean>(false);

  const applyOpenedProject = (
    opened: OpenProjectByIdResult | OpenOrCreateProjectResult
  ) => {
    setProjectId(opened.projectId);
    setDirectory(opened.directory);
    setCurrentBranch(opened.currentBranch);
    setMergeConflictInfo(opened.mergeConflictInfo);
    setRemoteProject(
      opened.remoteProjects.length > 0 ? opened.remoteProjects[0] : null
    );
    setProjectStore(opened.projectStore);
    registerProjectStore(opened.projectStore);
  };

  useEffect(() => {
    const openStoredProject = async () => {
      const storedProject = readStoredProject();

      if (!storedProject?.projectId || !storedProject?.directoryPath) return;

      setLoading(true);

      const opened = await Effect.runPromise(
        projectStoreManager.openProjectById({
          filesystem,
        })({
          projectId: storedProject.projectId,
          directoryPath: storedProject.directoryPath,
          username,
          email,
        })
      );

      applyOpenedProject(opened);

      setLoading(false);

      if (opened.mergeConflictInfo) {
        navigateToResolveMergeConflicts({
          projectId: opened.projectId,
          mergeConflictInfo: opened.mergeConflictInfo,
        });
        return;
      }

      // Only redirect to /artifacts if the user isn't already on a project
      // subroute (e.g. /history). This effect runs on mount, so when navigating
      // from /settings back to project routes the current location already
      // reflects the target subroute.
      const projectBase = `/projects/${urlEncodeProjectId(opened.projectId)}`;

      if (!location.pathname.startsWith(`${projectBase}/`)) {
        navigate(`${projectBase}/artifacts`);
      }
    };

    openStoredProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleOpenDirectory = useCallback(
    async (cloneUrl?: string) => {
      setLoading(true);

      const opened = await Effect.runPromise(
        projectStoreManager.openOrCreateProject({
          filesystem,
        })({ username, email, cloneUrl })
      );

      applyOpenedProject(opened);

      storeProject({
        projectId: opened.projectId,
        directoryPath: opened.directory.path,
      });

      setLoading(false);

      if (opened.mergeConflictInfo) {
        navigateToResolveMergeConflicts({
          projectId: opened.projectId,
          mergeConflictInfo: opened.mergeConflictInfo,
        });
      } else {
        navigate(`/projects/${urlEncodeProjectId(opened.projectId)}/artifacts`);
      }

      return opened.directory;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectStoreManager, filesystem, username, email]
  );

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

  const resetPulledUpstreamChanges = () => {
    setPulledUpstreamChanges(false);
  };

  return {
    loading,
    projectId,
    directory,
    currentBranch,
    projectStore,
    openDirectory: handleOpenDirectory,
    requestPermissionForSelectedDirectory,
    mergeConflictInfo,
    remoteProject,
    pulledUpstreamChanges,
    onHandlePulledUpstreamChanges: resetPulledUpstreamChanges,
    setCurrentBranch,
    setMergeConflictInfo,
    setRemoteProject,
    setPulledUpstreamChanges,
  };
};
