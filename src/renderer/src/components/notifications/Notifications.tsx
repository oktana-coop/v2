import { GenericNotifications } from './GenericNotifications';
import { NotificationsContainer } from './NotificationsContainer';
import { UpdateNotification } from './UpdateNotification';

export const Notifications = () => (
  <NotificationsContainer>
    <UpdateNotification />
    <GenericNotifications />
  </NotificationsContainer>
);
