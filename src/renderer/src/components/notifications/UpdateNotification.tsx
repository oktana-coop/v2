import { useContext } from 'react';

import {
  ElectronContext,
  isUpdateAvailableState,
} from '../../../../modules/infrastructure/cross-platform';
import { UpdateIcon } from '../icons';
import { NotificationWithActions } from './NotificationWithActions';

export const UpdateNotification = () => {
  const { updateState, dismissUpdateNotification } =
    useContext(ElectronContext);

  if (!updateState) {
    return null;
  }

  if (isUpdateAvailableState(updateState)) {
    return (
      <NotificationWithActions
        show={true}
        onClose={dismissUpdateNotification}
        onMainActionClick={() => {}}
        onSecondaryActionClick={dismissUpdateNotification}
        icon={UpdateIcon}
        title="Update Available"
        message="A new version of the app is available."
        mainActionLabel="Install"
        secondaryActionLabel="Dismiss"
      />
    );
  }
};
