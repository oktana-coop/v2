import { UpdateIcon } from '../icons';
import { NotificationWithActions } from './NotificationWithActions';

export const UpdateNotification = () => (
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
