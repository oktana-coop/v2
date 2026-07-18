import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useCallback, useContext, useEffect, useState } from 'react';

import {
  DEFAULT_REMOTE_PROJECT_NAME,
  type ProjectId,
  type ProjectStore,
  type RemoteProjectInfo,
} from '../../../../modules/domain/project';
import {
  createErrorNotification,
  createSuccessNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import {
  type Branch,
  type Commit,
} from '../../../../modules/infrastructure/version-control';
import { type ProjectContextType, type ProjectStateSetters } from './types';

type RemoteDeps = Pick<
  ProjectContextType,
  'projectId' | 'projectStore' | 'remoteProject'
> &
  Pick<ProjectStateSetters, 'setRemoteProject' | 'setPulledUpstreamChanges'>;

type RemoteOps = Pick<
  ProjectContextType,
  | 'remoteBranchInfo'
  | 'addRemoteProject'
  | 'pushToRemoteProject'
  | 'pullFromRemoteProject'
  | 'supportsSync'
>;

export const useRemoteOps = ({
  projectId,
  projectStore,
  remoteProject,
  setRemoteProject,
  setPulledUpstreamChanges,
}: RemoteDeps): RemoteOps => {
  const { dispatchNotification } = useContext(NotificationsContext);

  const [remoteBranchInfo, setRemoteBranchInfo] = useState<
    Record<Branch, Commit['id']>
  >({});

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [projectStore, projectId, remoteProject, dispatchNotification]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStore, projectId, remoteProject, dispatchNotification]);

  return {
    remoteBranchInfo,
    addRemoteProject: handleAddRemoteProject,
    pushToRemoteProject: handlePushToRemoteProject,
    pullFromRemoteProject: handlePullFromRemoteProject,
    supportsSync: Boolean(remoteProject),
  };
};
