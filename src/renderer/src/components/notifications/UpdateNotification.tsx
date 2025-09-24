import { useContext } from 'react';

import {
  ElectronContext,
  isDownloadingUpdateState,
  isUpdateAvailableState,
} from '../../../../modules/infrastructure/cross-platform';
import { UpdateIcon } from '../icons';
import { ProgressBar } from '../progress/ProgressBar';
import { NotificationWithActions } from './NotificationWithActions';

export const UpdateNotification = () => {
  const { updateState, dismissUpdateNotification, downloadUpdate } =
    useContext(ElectronContext);

  if (!updateState) {
    return null;
  }

  if (isUpdateAvailableState(updateState)) {
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
  }

  if (isDownloadingUpdateState(updateState)) {
    return (
      <NotificationWithActions
        show={true}
        onClose={dismissUpdateNotification}
        onMainActionClick={() => {}}
        onSecondaryActionClick={dismissUpdateNotification}
        icon={UpdateIcon}
        title="Downloading Update..."
        messageElement={
          <ProgressBar percentage={updateState.progress} classes="mt-3" />
        }
        mainActionLabel="Downloading"
        mainActionDisabled={true}
      />
    );
  }
};
