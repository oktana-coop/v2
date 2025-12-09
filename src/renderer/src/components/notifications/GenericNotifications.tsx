import { useContext } from 'react';

import {
  type ErrorNotification as ErrorNotificationType,
  type InfoNotification as InfoNotificationType,
  isErrorNotification,
  NotificationsContext,
} from '../../../../modules/infrastructure/notifications/browser';
import { ErrorIcon, InfoIcon } from '../icons';
import { SimpleNotification } from './SimpleNotification';

const InfoNotification = ({
  notification,
  onClose,
}: {
  notification: InfoNotificationType;
  onClose: () => void;
}) => (
  <SimpleNotification
    show={true}
    onClose={onClose}
    icon={InfoIcon}
    title={notification.title}
    message={notification.message}
  />
);

const ErrorNotification = ({
  notification,
  onClose,
}: {
  notification: ErrorNotificationType;
  onClose: () => void;
}) => (
  <SimpleNotification
    show={true}
    onClose={onClose}
    icon={ErrorIcon}
    iconClasses="text-red-400"
    title={notification.title}
    message={notification.message}
  />
);

export const GenericNotifications = () => {
  const { notifications, dismissNotification } =
    useContext(NotificationsContext);

  const handleDismissNotification = (id: string) => () => {
    dismissNotification(id);
  };

  return Object.values(notifications).map((notification) =>
    isErrorNotification(notification) ? (
      <ErrorNotification
        key={notification.id}
        notification={notification}
        onClose={handleDismissNotification(notification.id)}
      />
    ) : (
      <InfoNotification
        key={notification.id}
        notification={notification}
        onClose={handleDismissNotification(notification.id)}
      />
    )
  );
};
