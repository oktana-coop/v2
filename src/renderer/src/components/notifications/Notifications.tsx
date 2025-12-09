import { GenericNotifications } from './GenericNotifications';
import { NotificationsContainer } from './NotificationsContainer';
import { UpdateNotification } from './UpdateNotification';

export const Notifications = () => (
  <NotificationsContainer>
    {/* TODO: Incorporate update notifications to the generic notifications mechanism */}
    <UpdateNotification />
    <GenericNotifications />
  </NotificationsContainer>
);
