import { useContext } from 'react';

import {
  ElectronContext,
  isUpdateAvailableState,
} from '../../../../modules/infrastructure/cross-platform';
import { UpdateIcon } from '../icons';
import { NotificationWithActions } from './NotificationWithActions';

export const UpdateNotification = () => {
  const { updateState } = useContext(ElectronContext);

  if (!updateState) {
    return null;
  }

  if (isUpdateAvailableState(updateState)) {
    return (
      <NotificationWithActions
        show={true}
        onClose={() => {}}
        onMainActionClick={() => {}}
        onSecondaryActionClick={() => {}}
        icon={UpdateIcon}
        title="Update Available"
        message="A new version of the app is available."
        mainActionLabel="Install"
        secondaryActionLabel="Dismiss"
      />
    );
  }
};
