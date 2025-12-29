import { useContext } from 'react';

import {
  type ErrorNotification as ErrorNotificationType,
  type InfoNotification as InfoNotificationType,
  isErrorNotification,
  isSuccessNotification,
  NotificationsContext,
  type SuccessNotification as SuccessNotificationType,
} from '../../../../modules/infrastructure/notifications/browser';
import { CheckIcon, ErrorIcon, InfoIcon } from '../icons';
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

const SuccessNotification = ({
  notification,
  onClose,
}: {
  notification: SuccessNotificationType;
  onClose: () => void;
}) => (
  <SimpleNotification
    show={true}
    onClose={onClose}
    icon={CheckIcon}
    iconClasses="text-green-400"
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

  return Object.values(notifications).map((notification) => {
    if (isErrorNotification(notification)) {
      return (
        <ErrorNotification
          key={notification.id}
          notification={notification}
          onClose={handleDismissNotification(notification.id)}
        />
      );
    } else if (isSuccessNotification(notification)) {
      return (
        <SuccessNotification
          key={notification.id}
          notification={notification}
          onClose={handleDismissNotification(notification.id)}
        />
      );
    } else {
      return (
        <InfoNotification
          key={notification.id}
          notification={notification}
          onClose={handleDismissNotification(notification.id)}
        />
      );
    }
  });
};
