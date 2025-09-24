import { useContext } from 'react';

import { ElectronContext } from '../../../../modules/infrastructure/cross-platform';
import { ErrorIcon, UpdateIcon } from '../icons';
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
    case 'update-error':
      return (
        <SimpleNotification
          show={true}
          onClose={dismissUpdateNotification}
          icon={ErrorIcon}
          iconClasses="text-red-400"
          title="Update Error"
          message="An error occured while preparing the update."
        />
      );
    default:
      return null;
  }
};
