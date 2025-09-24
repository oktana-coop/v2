import { useContext } from 'react';

import { ElectronContext } from '../../../../modules/infrastructure/cross-platform';
import { UpdateIcon } from '../icons';
import { ProgressBar } from '../progress/ProgressBar';
import { NotificationWithActions } from './NotificationWithActions';
import { SimpleNotification } from './SimpleNotification';

export const UpdateNotification = () => {
  const {
    updateState,
    dismissUpdateNotification,
    downloadUpdate,
    restartToInstallUpdate,
  } = useContext(ElectronContext);

  return (
    <SimpleNotification
      show={true}
      onClose={dismissUpdateNotification}
      icon={UpdateIcon}
      title="Downloading Update..."
      messageElement={<ProgressBar percentage={0.35} classes="mt-3" />}
    />
  );

  switch (updateState?.status) {
    case 'update-not-available':
      return (
        <SimpleNotification
          show={true}
          onClose={dismissUpdateNotification}
          icon={UpdateIcon}
          title="No Updates Available"
          message="You are using the latest version of the app."
        />
      );
    case 'update-available':
      return (
        <NotificationWithActions
          show={true}
          onClose={dismissUpdateNotification}
          onMainActionClick={downloadUpdate}
          onSecondaryActionClick={dismissUpdateNotification}
          icon={UpdateIcon}
          title="Update Available"
          message="A new version of the app is available."
          mainActionLabel="Install"
          secondaryActionLabel="Dismiss"
        />
      );
    case 'downloading-update':
      return (
        <SimpleNotification
          show={true}
          onClose={dismissUpdateNotification}
          icon={UpdateIcon}
          title="Downloading Update..."
          messageElement={
            <ProgressBar percentage={updateState.progress} classes="mt-3" />
          }
        />
      );
    case 'update-downloaded':
      return (
        <NotificationWithActions
          show={true}
          onClose={dismissUpdateNotification}
          onMainActionClick={restartToInstallUpdate}
          onSecondaryActionClick={dismissUpdateNotification}
          icon={UpdateIcon}
          title="Update Ready to Install"
          message="A new version has been downloaded and is ready to install."
          mainActionLabel="Restart & Install"
          secondaryActionLabel="Dismiss"
        />
      );
    default:
      return null;
  }
};
